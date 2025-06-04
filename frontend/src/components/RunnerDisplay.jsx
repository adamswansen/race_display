import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './RunnerDisplay.css';

export default function RunnerDisplay() {
  const [runner, setRunner] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const displayRef = useRef(null);

  // Load templates from localStorage
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('gjs-templates') || '[]');
    if (saved.length === 0) {
      const defaultTemplate = {
        name: 'Default',
        html: '<div class="text-center p-4">\n  <h1 class="runner-name">Runner Name</h1>\n  <h3 class="runner-city">City</h3>\n  <p class="runner-message">Great job!</p>\n</div>'
      };
      localStorage.setItem('gjs-templates', JSON.stringify([defaultTemplate]));
      setTemplates([defaultTemplate]);
      setSelected(defaultTemplate.name);
    } else {
      setTemplates(saved);
      setSelected(saved[0].name);
    }
  }, []);

  // Apply template HTML
  useEffect(() => {
    const tmpl = templates.find(t => t.name === selected);
    if (tmpl && displayRef.current) {
      displayRef.current.innerHTML = tmpl.html;
    }
  }, [selected, templates]);

  // Update runner info in template
  useEffect(() => {
    if (!runner || !displayRef.current) return;
    const el = displayRef.current;
    const set = (cls, value) => {
      const node = el.querySelector('.' + cls);
      if (node) node.textContent = value || '';
    };
    set('runner-name', runner.name);
    set('runner-city', runner.city);
    set('runner-message', runner.message);
    set('bib-number', runner.bib);
  }, [runner, selected]);

  // Stream timing data
  useEffect(() => {
    const es = new EventSource('/stream');
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (!data.keepalive) setRunner(data);
      } catch {}
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, []);

  return (
    <div className="runner-display-container">
      <button className="settings-btn btn btn-light" onClick={() => setShowSettings(!showSettings)}>⚙️</button>
      <div ref={displayRef} className="runner-template"></div>
      {showSettings && (
        <div className="settings-panel">
          <h5>Display Settings</h5>
          <select className="form-select mb-3" value={selected} onChange={e => setSelected(e.target.value)}>
            {templates.map(t => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </select>
          <Link to="/builder" className="btn btn-secondary w-100">Open Builder</Link>
        </div>
      )}
    </div>
  );
}
