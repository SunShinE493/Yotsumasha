import React from 'react';
import { useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
  const navigate = useNavigate();

  const goToTest = () => {
    navigate('/test');
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>ホームページ</h1>
      <p>これはホームページです。</p>
      <button 
        onClick={goToTest}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        テストページに移動
      </button>
    </div>
  );
};

export default Home;