import React from 'react';
import { useNavigate } from 'react-router-dom';

const Test: React.FC = () => {
  const navigate = useNavigate();

  const goToHome = () => {
    navigate('/');
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>テストページ</h1>
      <p>これはテストページです。</p>
      <button 
        onClick={goToHome}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        ホームに戻る
      </button>
    </div>
  );
};

export default Test;