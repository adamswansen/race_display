import React, { useEffect, useRef, useState, useCallback } from 'react';
import grapesjs from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import './CanvasBuilder.css';

// Constants for editor configuration
const EDITOR_CONFIG = {
  container: '#gjs',
  height: '600px',
  storageManager: false,
  panels: { defaults: [] },
  deviceManager: {
    devices: [
      {
        name: 'Desktop',
        width: '',
      },
      {
        name: 'Mobile',
        width: '320px',
        widthMedia: '480px',
      }
    ]
  },
  canvas: {
    styles: [
      'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css'
    ],
    scripts: [
      'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js'
    ]
  },
  layerManager: {
    appendTo: '.layers-container'
  },
  panels: {
    defaults: [
      {
        id: 'layers',
        el: '.panel__right',
        resizable: {
          tc: 0, // Top handler
          cr: 1, // Right handler
          cl: 0, // Left handler
          bc: 0, // Bottom handler
          keyWidth: 'flex-basis',
          keyHeight: 'height',
        },
      },
      {
        id: 'panel-switcher',
        el: '.panel__switcher',
        buttons: [
          {
            id: 'show-layers',
            active: true,
            label: 'Layers',
            command: 'show-layers',
            togglable: false,
          },
          {
            id: 'show-style',
            active: true,
            label: 'Styles',
            command: 'show-styles',
            togglable: false,
          }
        ],
      }
    ]
  },
  assetManager: {
    upload: '/api/upload-image',
    uploadName: 'files',
    uploadPath: '/static/uploads/',
    assets: []
  },
  styleManager: {
    appendTo: '#style',
    sectors: [
      {
        name: 'Dimension',
        open: false,
        buildProps: ['width', 'height', 'min-width', 'min-height', 'padding', 'margin'],
      },
      {
        name: 'Typography',
        open: false,
        buildProps: ['font-family', 'font-size', 'font-weight', 'letter-spacing', 'color', 'line-height', 'text-align', 'text-decoration', 'text-shadow'],
      },
      {
        name: 'Decorations',
        open: false,
        buildProps: ['border-radius', 'border', 'box-shadow', 'background'],
      },
      {
        name: 'Extra',
        open: false,
        buildProps: ['opacity', 'transition', 'transform'],
      },
      {
        name: 'Position',
        open: false,
        buildProps: ['position', 'top', 'right', 'left', 'bottom', 'z-index'],
      },
      {
        name: 'Alignment',
        open: false,
        buildProps: ['display', 'flex-direction', 'justify-content', 'align-items', 'text-align'],
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
        id: 'image',
        label: 'Image',
        content: { type: 'image' },
        category: 'Images',
        attributes: {
          class: 'gjs-block',
          title: 'Drag Image'
        }
      },
      {
        id: 'background',
        label: 'Background',
        content: '<div style="min-height:100px; background-image:url(\'\'); background-size: cover; background-position: center;"></div>',
        category: 'Layout',
        attributes: {
          class: 'gjs-block',
          title: 'Drag Background'
        }
      }
    ]
  }
};

// Utility functions
const snap = v => Math.round(parseInt(v) / 20) * 20;
const applySnap = model => {
  const style = model.getStyle();
  ['top', 'left', 'width', 'height'].forEach(p => {
    const val = parseInt(style[p]);
    if (!isNaN(val)) model.addStyle({ [p]: snap(val) + 'px' });
  });
};

export default function CanvasBuilder() {
  const editorRef = useRef(null);
  const [templates, setTemplates] = useState([]);

  // Initialize editor
  useEffect(() => {
    if (!editorRef.current) {
      const editor = grapesjs.init({
        container: '#gjs',
        height: '600px',
        storageManager: false,
        deviceManager: {
          devices: [
            {
              name: 'Desktop',
              width: '',
            },
            {
              name: 'Mobile',
              width: '320px',
              widthMedia: '480px',
            }
          ]
        },
        canvas: {
          styles: [
            'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css'
          ],
          scripts: [
            'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js'
          ]
        },
        layerManager: {
          appendTo: '.layers-container'
        },
        panels: {
          defaults: [
            {
              id: 'layers',
              el: '.panel__right',
              resizable: {
                tc: 0,
                cr: 1,
                cl: 0,
                bc: 0,
                keyWidth: 'flex-basis',
                keyHeight: 'height',
              },
            },
            {
              id: 'panel-switcher',
              el: '.panel__switcher',
              buttons: [
                {
                  id: 'show-layers',
                  active: true,
                  label: 'Layers',
                  command: 'show-layers',
                  togglable: false,
                },
                {
                  id: 'show-style',
                  active: true,
                  label: 'Styles',
                  command: 'show-styles',
                  togglable: false,
                }
              ],
            }
          ]
        },
        assetManager: {
          upload: '/api/upload-image',
          uploadName: 'files',
          uploadPath: '/static/uploads/',
          assets: []
        },
        styleManager: {
          appendTo: '#style',
          sectors: [
            {
              name: 'Dimension',
              open: false,
              buildProps: ['width', 'height', 'min-width', 'min-height', 'padding', 'margin'],
            },
            {
              name: 'Typography',
              open: false,
              buildProps: ['font-family', 'font-size', 'font-weight', 'letter-spacing', 'color', 'line-height', 'text-align', 'text-decoration', 'text-shadow'],
            },
            {
              name: 'Decorations',
              open: false,
              buildProps: ['border-radius', 'border', 'box-shadow', 'background'],
            },
            {
              name: 'Extra',
              open: false,
              buildProps: ['opacity', 'transition', 'transform'],
            },
            {
              name: 'Position',
              open: false,
              buildProps: ['position', 'top', 'right', 'left', 'bottom', 'z-index'],
            },
            {
              name: 'Alignment',
              open: false,
              buildProps: ['display', 'flex-direction', 'justify-content', 'align-items', 'text-align'],
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
              id: 'image',
              label: 'Image',
              content: { type: 'image' },
              category: 'Images',
              attributes: {
                class: 'gjs-block',
                title: 'Drag Image'
              }
            },
            {
              id: 'background',
              label: 'Background',
              content: '<div style="min-height:100px; background-image:url(\'\'); background-size: cover; background-position: center;"></div>',
              category: 'Layout',
              attributes: {
                class: 'gjs-block',
                title: 'Drag Background'
              }
            }
          ]
        }
      });
      editorRef.current = editor;

      // Setup event listeners
      editor.on('component:drag:end', applySnap);
      editor.on('component:resize:end', applySnap);
      editor.on('component:selected', handleComponentSelected);

      // Register custom commands
      registerCustomCommands(editor);

      // Add custom commands for panels
      editor.Commands.add('show-layers', {
        run: (editor) => {
          const panel = editor.Panels.getPanel('layers');
          panel.set('visible', true);
        },
        stop: (editor) => {
          const panel = editor.Panels.getPanel('layers');
          panel.set('visible', false);
        }
      });

      editor.Commands.add('show-styles', {
        run: (editor) => {
          const panel = editor.Panels.getPanel('styles');
          panel.set('visible', true);
        },
        stop: (editor) => {
          const panel = editor.Panels.getPanel('styles');
          panel.set('visible', false);
        }
      });

      // Add alignment commands
      editor.Commands.add('align-center', {
        run: (editor) => {
          const selected = editor.getSelected();
          if (selected) {
            selected.addStyle({
              'display': 'flex',
              'justify-content': 'center',
              'align-items': 'center',
              'text-align': 'center'
            });
          }
        }
      });

      editor.Commands.add('align-left', {
        run: (editor) => {
          const selected = editor.getSelected();
          if (selected) {
            selected.addStyle({
              'display': 'flex',
              'justify-content': 'flex-start',
              'align-items': 'center',
              'text-align': 'left'
            });
          }
        }
      });

      editor.Commands.add('align-right', {
        run: (editor) => {
          const selected = editor.getSelected();
          if (selected) {
            selected.addStyle({
              'display': 'flex',
              'justify-content': 'flex-end',
              'align-items': 'center',
              'text-align': 'right'
            });
          }
        }
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

  // Load templates
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/templates');
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  const handleComponentSelected = m => {
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
  };

  const registerCustomCommands = editor => {
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
  };

  const handleSave = async () => {
    const name = prompt('Template name');
    if (!name) return;
    
    try {
      const html = editorRef.current.getHtml();
      const css = editorRef.current.getCss();
      const full = `<style>${css}</style>${html}`;
      
      await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, html: full })
      });
      
      await fetchTemplates();
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  };

  const handleLoad = async e => {
    const name = e.target.value;
    if (!name) return;
    
    try {
      const response = await fetch(`/api/templates/${name}`);
      const data = await response.json();
      
      if (editorRef.current) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = data.html || '';
        const styleEl = wrapper.querySelector('style');
        const style = styleEl ? styleEl.innerHTML : '';
        if (styleEl) styleEl.remove();
        editorRef.current.setComponents(wrapper.innerHTML);
        editorRef.current.setStyle(style);
      }
    } catch (error) {
      console.error('Failed to load template:', error);
    }
  };

  return (
    <div className="canvas-builder">
      <div className="canvas-builder__toolbar">
        <button className="btn btn-secondary me-2" onClick={() => editorRef.current.runCommand('core:undo')}>Undo</button>
        <button className="btn btn-secondary me-2" onClick={() => editorRef.current.runCommand('core:redo')}>Redo</button>
        <button className="btn btn-secondary me-2" onClick={() => editorRef.current.runCommand('open-assets')}>Images</button>
        <button className="btn btn-secondary me-2" onClick={() => editorRef.current.runCommand('fullscreen')}>Fullscreen</button>
        <button className="btn btn-primary me-2" onClick={() => editorRef.current.runCommand('save-template')}>Save Template</button>
        <div className="btn-group me-2">
          <button className="btn btn-outline-secondary" onClick={() => editorRef.current.runCommand('align-left')} title="Align Left">
            ←
          </button>
          <button className="btn btn-outline-secondary" onClick={() => editorRef.current.runCommand('align-center')} title="Align Center">
            ↔
          </button>
          <button className="btn btn-outline-secondary" onClick={() => editorRef.current.runCommand('align-right')} title="Align Right">
            →
          </button>
        </div>
        <select className="form-select d-inline w-auto" onChange={handleLoad}>
          <option value="">Load Template...</option>
          {templates.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="canvas-builder__workspace">
        <div id="blocks" className="canvas-builder__blocks"></div>
        <div id="gjs" className="canvas-builder__editor"></div>
        <div className="canvas-builder__right-panel">
          <div className="panel__switcher"></div>
          <div className="panel__right"></div>
          <div id="style" className="canvas-builder__styles"></div>
        </div>
      </div>
    </div>
  );
}
