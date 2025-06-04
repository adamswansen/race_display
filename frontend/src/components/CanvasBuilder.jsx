import React, { useEffect, useRef, useState, useCallback } from 'react';
import grapesjs from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import './CanvasBuilder.css';

export default function CanvasBuilder() {
  const editorRef = useRef(null);
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    if (!editorRef.current) {
      const editor = grapesjs.init({
        container: '#gjs',
        height: '600px',
        storageManager: false,
        panels: { defaults: [] },
        assetManager: {
          upload: '/api/upload-image',
          uploadName: 'files'
        },
        styleManager: {
          appendTo: '#style',
          sectors: [
            {
              name: 'Typography',
              open: true,
              buildProps: ['font-size', 'color', 'text-align']
            },
            {
              name: 'Dimension',
              open: false,
              buildProps: ['width', 'height']
            }
          ]
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
            },
            {
              id: 'sponsor',
              label: 'Sponsor Image',
              content: '<img src="" alt="Sponsor" />',
            },
            {
              id: 'background',
              label: 'Background',
              content: '<div style="min-height:100px; background-image:url(\'\');"></div>',
            }
          ]
        }
      });
      editorRef.current = editor;

      const snap = v => Math.round(parseInt(v) / 20) * 20;
      const applySnap = model => {
        const style = model.getStyle();
        ['top', 'left', 'width', 'height'].forEach(p => {
          const val = parseInt(style[p]);
          if (!isNaN(val)) model.addStyle({ [p]: snap(val) + 'px' });
        });
      };
      editor.on('component:drag:end', applySnap);
      editor.on('component:resize:end', applySnap);

      editor.on('component:selected', m => {
        const tb = [...(m.get('toolbar') || [])];
        const add = (id, command, label) => {
          if (!tb.find(t => t.id === id)) tb.push({ id, command, label });
        };
        add('duplicate', 'core:clone', 'Dup');
        add('delete', 'core:delete', 'Del');
        add('align-l', 'align-left', 'L');
        add('align-c', 'align-center', 'C');
        add('align-r', 'align-right', 'R');
        m.set('toolbar', tb);
        m.set('resizable', true);
      });

      editor.Commands.add('save-template', { run: handleSave });
      editor.Commands.add('fullscreen', {
        run(ed) { ed.getContainer().classList.add('gjs-fullscreen'); },
        stop(ed) { ed.getContainer().classList.remove('gjs-fullscreen'); }
      });
      editor.Commands.add('align-left', {
        run(ed) { const s = ed.getSelected(); if (s) s.addStyle({ 'text-align': 'left' }); }
      });
      editor.Commands.add('align-center', {
        run(ed) { const s = ed.getSelected(); if (s) s.addStyle({ 'text-align': 'center' }); }
      });
      editor.Commands.add('align-right', {
        run(ed) { const s = ed.getSelected(); if (s) s.addStyle({ 'text-align': 'right' }); }
      });

      editor.on('load', () => {
        const root = editor.getWrapper();
        if (!root.components().length) {
          const container = root.append(`
            <div class="layout-root" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;border:2px dashed #ccc;">
              <span style="color:#888;font-size:1.1rem;">
                Drop or click ＋ to add elements
              </span>
            </div>
          `)[0];
          editor.select(container);
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
        <button className="btn btn-secondary me-2" onClick={() => editorRef.current.runCommand('core:undo')}>Undo</button>
        <button className="btn btn-secondary me-2" onClick={() => editorRef.current.runCommand('core:redo')}>Redo</button>
        <button className="btn btn-secondary me-2" onClick={() => editorRef.current.runCommand('open-assets')}>Images</button>
        <button className="btn btn-secondary me-2" onClick={() => editorRef.current.runCommand('fullscreen')}>Fullscreen</button>
        <button className="btn btn-primary me-2" onClick={() => editorRef.current.runCommand('save-template')}>Save Template</button>
        <select className="form-select d-inline w-auto" onChange={handleLoad}>
          <option value="">Load Template...</option>
          {templates.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="row">
        <div id="blocks" className="col-2"></div>
        <div id="gjs" className="col-8"></div>
        <div id="style" className="col-2"></div>
      </div>
    </div>
  );
}
