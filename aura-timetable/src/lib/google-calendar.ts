import { Course, TimetableState, cellKey, PeriodTime } from './types';

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  location?: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

/**
 * Maps Google Calendar events to the Timetable state.
 */
export function mapEventsToTimetable(
  events: GoogleCalendarEvent[],
  currentState: TimetableState
): TimetableState {
  const newState = { ...currentState };
  const newTimetable = { ...newState.timetable };
  const newCourses = [...newState.courses];

  events.forEach(event => {
    const startTimeStr = event.start.dateTime || event.start.date;
    if (!startTimeStr) return;

    const startDate = new Date(startTimeStr);
    const dayIndex = getDayIndexFromDate(startDate);
    if (dayIndex < 0 || dayIndex > 6) return;

    // Filter out weekend days if not shown
    if (!newState.showWeekend && dayIndex > 4) return;

    // Find overlapping periods
    const eventStartTime = startDate.getHours() * 60 + startDate.getMinutes();
    const eventEndTimeStr = event.end.dateTime || event.end.date;
    const endDate = eventEndTimeStr ? new Date(eventEndTimeStr) : startDate;
    const eventEndTime = event.end.dateTime ? endDate.getHours() * 60 + endDate.getMinutes() : eventStartTime + 60;
    
    // Attempt to find the best-fitting period
    newState.periods.forEach((period, periodIdx) => {
      const pStart = parseTime(period.start);
      const pEnd = parseTime(period.end);

      // Improved overlap check: event and period intersect in time
      if (eventStartTime < pEnd && eventEndTime > pStart) {
        // Look for existing course by name or create new
        let course = newCourses.find(c => c.name === event.summary);
        if (!course) {
          course = {
            id: 'google-' + event.id,
            name: event.summary,
            room: event.location || '',
            teacher: '',
            color: 'hsl(220, 90%, 65%)', // Default blue
          };
          newCourses.push(course);
        }

        const key = cellKey(dayIndex, periodIdx);
        if (newTimetable[key]) {
          // すでに予定が存在する場合
          const existingCourse = newCourses.find(c => c.id === newTimetable[key].courseId);
          if (existingCourse && (existingCourse.name.startsWith('[Task]') || event.summary.startsWith('[Task]'))) {
             newTimetable[key] = { ...newTimetable[key], hasConflict: true };
          }
          // [Task]ではない方を優先して上書きする（または既存のままにする）
          if (event.summary.startsWith('[Task]')) {
             // 新しいのがタスクなら上書きしない
             return;
          }
        }
        newTimetable[key] = { ...newTimetable[key], courseId: course.id };
      }
    });
  });

  return { ...newState, timetable: newTimetable, courses: newCourses };
}

function getDayIndexFromDate(d: Date): number {
  const jsDay = d.getDay(); // 0 is Sun
  return jsDay === 0 ? 6 : jsDay - 1; // 0 is Mon
}

function parseTime(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}
