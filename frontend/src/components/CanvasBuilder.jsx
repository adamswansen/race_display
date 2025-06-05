import React, { useEffect, useRef, useState, useCallback } from 'react';
import grapesjs from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import './CanvasBuilder.css';

// Constants for editor configuration
const EDITOR_CONFIG = {
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
    assets: [
      {
        type: 'image',
        src: '/static/uploads/SRS_black_bg_noword.png',
        name: 'SRS Logo'
      },
      {
        type: 'image',
        src: '/static/uploads/iRunTheD.jpg',
        name: 'iRunTheD'
      }
    ]
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
        name: 'Background',
        open: false,
        buildProps: ['background-color', 'background-image', 'background-repeat', 'background-position', 'background-size', 'background-attachment'],
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
        id: 'srs-logo',
        label: 'SRS Logo',
        content: '<img src="/static/uploads/SRS_black_bg_noword.png" alt="SRS Logo" style="max-width: 100%; height: auto;" />',
        category: 'Images',
        attributes: {
          class: 'gjs-block',
          title: 'Drag SRS Logo'
        }
      },
      {
        id: 'irun-logo',
        label: 'iRun Logo',
        content: '<img src="/static/uploads/iRunTheD.jpg" alt="iRun Logo" style="max-width: 100%; height: auto;" />',
        category: 'Images',
        attributes: {
          class: 'gjs-block',
          title: 'Drag iRun Logo'
        }
      },
      {
        id: 'image',
        label: 'Custom Image',
        content: '<img src="" alt="Custom Image" style="max-width: 100%; height: auto;" />',
        category: 'Images',
        attributes: {
          class: 'gjs-block',
          title: 'Drag Custom Image'
        }
      },
      {
        id: 'background',
        label: 'Background',
        category: 'Layout',
        content: `
          <div class="background-block" style="min-height: 100%; width: 100%; background-color: #f5f5f5; position: absolute; top: 0; left: 0; z-index: -1;">
            <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
              <span style="color: #666;">Background Container</span>
            </div>
          </div>
        `,
        attributes: {
          class: 'gjs-block',
          title: 'Drag Background Container'
        }
      },
      {
        id: 'gradient-background',
        label: 'Gradient Background',
        category: 'Layout',
        content: `
          <div class="gradient-background" style="min-height: 100%; width: 100%; background: linear-gradient(45deg, #6b48ff, #ff4848); position: absolute; top: 0; left: 0; z-index: -1;">
            <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
              <span style="color: white;">Gradient Background</span>
            </div>
          </div>
        `,
        attributes: {
          class: 'gjs-block',
          title: 'Drag Gradient Background'
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
          assets: [
            {
              type: 'image',
              src: '/static/uploads/SRS_black_bg_noword.png',
              name: 'SRS Logo'
            },
            {
              type: 'image',
              src: '/static/uploads/iRunTheD.jpg',
              name: 'iRunTheD'
            }
          ]
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
              name: 'Background',
              open: false,
              buildProps: ['background-color', 'background-image', 'background-repeat', 'background-position', 'background-size', 'background-attachment'],
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
              id: 'srs-logo',
              label: 'SRS Logo',
              content: '<img src="/static/uploads/SRS_black_bg_noword.png" alt="SRS Logo" style="max-width: 100%; height: auto;" />',
              category: 'Images',
              attributes: {
                class: 'gjs-block',
                title: 'Drag SRS Logo'
              }
            },
            {
              id: 'irun-logo',
              label: 'iRun Logo',
              content: '<img src="/static/uploads/iRunTheD.jpg" alt="iRun Logo" style="max-width: 100%; height: auto;" />',
              category: 'Images',
              attributes: {
                class: 'gjs-block',
                title: 'Drag iRun Logo'
              }
            },
            {
              id: 'image',
              label: 'Custom Image',
              content: '<img src="" alt="Custom Image" style="max-width: 100%; height: auto;" />',
              category: 'Images',
              attributes: {
                class: 'gjs-block',
                title: 'Drag Custom Image'
              }
            },
            {
              id: 'background',
              label: 'Background',
              category: 'Layout',
              content: `
                <div class="background-block" style="min-height: 100%; width: 100%; background-color: #f5f5f5; position: absolute; top: 0; left: 0; z-index: -1;">
                  <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
                    <span style="color: #666;">Background Container</span>
                  </div>
                </div>
              `,
              attributes: {
                class: 'gjs-block',
                title: 'Drag Background Container'
              }
            },
            {
              id: 'gradient-background',
              label: 'Gradient Background',
              category: 'Layout',
              content: `
                <div class="gradient-background" style="min-height: 100%; width: 100%; background: linear-gradient(45deg, #6b48ff, #ff4848); position: absolute; top: 0; left: 0; z-index: -1;">
                  <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
                    <span style="color: white;">Gradient Background</span>
                  </div>
                </div>
              `,
              attributes: {
                class: 'gjs-block',
                title: 'Drag Gradient Background'
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

        // Add background handling
        editor.on('component:add', (component) => {
          if (component.is('background-block') || component.is('gradient-background')) {
            const wrapper = component.getWrapper();
            wrapper.setStyle({
              'width': '100%',
              'height': '100%',
              'position': 'absolute',
              'top': '0',
              'left': '0',
              'z-index': '-1'
            });
          }
        });

        // Ensure body takes full height
        const body = editor.getBody();
        body.style.minHeight = '100%';
        body.style.height = '100%';
        body.style.margin = '0';
        body.style.padding = '0';
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
