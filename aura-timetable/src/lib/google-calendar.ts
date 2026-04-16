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
    
    // Attempt to find the best-fitting period
    newState.periods.forEach((period, periodIdx) => {
      const pStart = parseTime(period.start);
      const pEnd = parseTime(period.end);

      // Simple overlap check: if event starts within period or period starts within event
      // For a timetable, we usually just see if the event's start time is close to the period start.
      if (Math.abs(eventStartTime - pStart) < 30) {
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
        newTimetable[key] = { courseId: course.id };
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
