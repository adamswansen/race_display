import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [eventId, setEventId] = useState('');
  const [status, setStatus] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Connecting...');
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
    }
  };

  return (
    <div className="container p-4">
      <h2>Race Display Login</h2>
      <form onSubmit={handleSubmit} className="mb-3">
        <div className="mb-2">
          <input className="form-control" placeholder="User ID" value={userId} onChange={e => setUserId(e.target.value)} required />
        </div>
        <div className="mb-2">
          <input className="form-control" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <div className="mb-2">
          <input className="form-control" placeholder="Event ID" value={eventId} onChange={e => setEventId(e.target.value)} required />
        </div>
        <button className="btn btn-primary" type="submit">Login</button>
      </form>
      {status && <div className="alert alert-info">{status}</div>}
    </div>
  );
}
