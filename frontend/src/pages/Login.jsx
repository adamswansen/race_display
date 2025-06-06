import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [eventId, setEventId] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const pollRef = useRef(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Connecting...');
    setProgress({ loaded: 0, total: 0 });

    const fetchProgress = async () => {
      try {
        const res = await fetch('/api/login-progress');
        if (res.ok) {
          const p = await res.json();
          setProgress({ loaded: p.loaded_entries, total: p.total_entries });
          if (p.complete && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch (_) {
        // ignore polling errors
      }
    };
    pollRef.current = setInterval(fetchProgress, 500);
    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('password', password);
    formData.append('event_id', eventId);

    try {
      const res = await fetch('/api/login', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        navigate('/display');
      } else {
        setStatus(data.error || 'Login failed');
      }
    } catch (err) {
      setStatus('Network error');
    } finally {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <form onSubmit={handleSubmit} className="rd-form">
        <h2 className="mb-4">Race Display Login</h2>
        <div className="rd-form-control">
          <input
            className="rd-input"
            placeholder="User ID"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            required
          />
        </div>
        <div className="rd-form-control">
          <input
            className="rd-input"
            placeholder="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="rd-form-control">
          <input
            className="rd-input"
            placeholder="Event ID"
            value={eventId}
            onChange={e => setEventId(e.target.value)}
            required
          />
        </div>
        <div className="rd-button-group">
          <button className="rd-button" type="submit">Login</button>
        </div>
        {status && <div className="rd-alert">{status}</div>}
        {progress.total > 0 && (
          <div className="progress mt-2" style={{ width: '100%' }}>
            <div
              className="progress-bar"
              role="progressbar"
              style={{ width: `${(progress.loaded / progress.total) * 100}%` }}
              aria-valuenow={progress.loaded}
              aria-valuemin="0"
              aria-valuemax={progress.total}
            >{`${progress.loaded}/${progress.total}`}</div>
          </div>
        )}
      </form>
    </div>
  );
}
