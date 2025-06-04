import React, { useEffect, useRef, useState } from 'react';
import grapesjs from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';

export default function CanvasBuilder() {
  const editorRef = useRef(null);
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    if (!editorRef.current) {
      editorRef.current = grapesjs.init({
        container: '#gjs',
        height: '600px',
        storageManager: false,
        panels: { defaults: [] },
        assetManager: {
          upload: '/api/upload-image',
          uploadName: 'files'
        },
        blockManager: {
          appendTo: '#blocks',
          blocks: [
            {
              id: 'bib',
              label: 'Bib Number',
              content: '<span data-placeholder="bib">{{bib}}</span>',
            },
            {
              id: 'name',
              label: 'Name',
              content: '<span data-placeholder="name">{{name}}</span>',
            },
            {
              id: 'city',
              label: 'City/State',
              content: '<span data-placeholder="city">{{city}}</span>',
            },
            {
              id: 'logo',
              label: 'Logo',
              content: '<img src="/static/images/logo.png" alt="Logo" />',
            },
            {
              id: 'image',
              label: 'Image',
              content: '<img src="" alt="" />',
            }
          ]
        }
      });
    }
  }, []);

  useEffect(() => {
    fetch('/api/templates')
      .then(res => res.json())
      .then(data => setTemplates(data))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    const name = prompt('Template name');
    if (!name) return;
    const html = editorRef.current.getHtml();
    const css = editorRef.current.getCss();
    const full = `<style>${css}</style>${html}`;
    await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, html: full })
    });
    const list = await fetch('/api/templates').then(res => res.json());
    setTemplates(list);
  };

  const handleLoad = async e => {
    const name = e.target.value;
    if (!name) return;
    const data = await fetch(`/api/templates/${name}`).then(res => res.json());
    if (editorRef.current) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = data.html || '';
      const styleEl = wrapper.querySelector('style');
      const style = styleEl ? styleEl.innerHTML : '';
      if (styleEl) styleEl.remove();
      editorRef.current.setComponents(wrapper.innerHTML);
      editorRef.current.setStyle(style);
    }
  };

  return (
    <div>
      <div className="mb-2">
        <button className="btn btn-primary me-2" onClick={handleSave}>Save Template</button>
        <select className="form-select d-inline w-auto" onChange={handleLoad}>
          <option value="">Load Template...</option>
          {templates.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="row">
        <div id="blocks" className="col-2"></div>
        <div id="gjs" className="col"></div>
      </div>
    </div>
  );
}
