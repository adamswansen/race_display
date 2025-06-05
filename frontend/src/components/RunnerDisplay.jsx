import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './RunnerDisplay.css';

export default function RunnerDisplay() {
  const [runner, setRunner] = useState(null);
  const [templates, setTemplates] = useState([]); // list of template names
  const [selected, setSelected] = useState('');
  const [templateHTML, setTemplateHTML] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const displayRef = useRef(null);

  // Load templates from the server
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch('/api/templates');
        const data = await response.json();
        if (data.length === 0) {
          setTemplates(['Default']);
          setSelected('Default');
          setTemplateHTML(
            '<div class="text-center p-4">\n  <h1 data-placeholder="name">{{name}}</h1>\n  <h3 data-placeholder="city">{{city}}</h3>\n  <p data-placeholder="message">{{message}}</p>\n</div>'
          );
        } else {
          setTemplates(data);
          setSelected(data[0]);
        }
      } catch (err) {
        console.error('Failed to fetch templates:', err);
      }
    };
    fetchTemplates();
  }, []);

  // Load selected template HTML
  useEffect(() => {
    if (!selected) return;
    const fetchTemplate = async () => {
      try {
        const response = await fetch(`/api/templates/${selected}`);
        const data = await response.json();
        setTemplateHTML(data.html || '');
      } catch (err) {
        console.error('Failed to load template:', err);
      }
    };
    fetchTemplate();
  }, [selected]);

  // Apply template HTML to the DOM
  useEffect(() => {
    if (displayRef.current) {
      displayRef.current.innerHTML = templateHTML;
    }
  }, [templateHTML]);

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

    // Update GrapesJS placeholders
    el.querySelectorAll('[data-placeholder]').forEach(node => {
      const key = node.getAttribute('data-placeholder');
      if (key && runner[key] !== undefined) {
        if (node.tagName === 'IMG') {
          node.src = runner[key];
        } else {
          node.textContent = runner[key] || '';
        }
      }
    });
  }, [runner, templateHTML]);

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
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <Link to="/builder" className="btn btn-secondary w-100">Open Builder</Link>
        </div>
      )}
    </div>
  );
}
