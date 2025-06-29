import React, { useEffect, useRef, useState, useCallback } from 'react';
import grapesjs from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import './CanvasBuilder.css';

// Add custom CSS to hide the panel
const customStyles = `
  .panel__right.gjs-pn-panel.gjs-pn-layers {
    display: none !important;
  }
`;

// Constants for editor configuration
const EDITOR_CONFIG = {
  container: '#gjs',
  height: '600px',
  storageManager: false,
  draggable: true,
  resizable: true,
  wrapper: {
    removable: false,
    copyable: false,
    draggable: false,
    style: {
      'min-height': '100%',
      'height': '100%',
      'margin': '0',
      'padding': '0',
      'position': 'relative'
    }
  },
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
      'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css',
      {
        selectors: ['body'],
        style: {
          'min-height': '100%',
          'height': '100%',
          'margin': '0',
          'padding': '0',
          'position': 'relative'
        }
      }
    ],
    scripts: [
      'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js'
    ],
    customBadgeLabel: false,
    enableSelection: true,
    enableDragging: true,
    enableResizing: true,
    dragMode: 'absolute'
  },
  layerManager: {
    appendTo: '.layers-container',
    container: '.panel__right',
    wrapper: false,
    panel: false
  },
  panels: {
    defaults: [
      {
        id: 'layers',
        el: '.panel__right',
        buttons: [],
        appendTo: '.panel__right',
        visible: true,
        header: false,
        resizable: false,
        panel: false
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
        id: 'image',
        label: 'Image',
        content: { type: 'image' },
        attributes: {
          class: 'gjs-block',
          title: 'Drag Image'
        }
      },
      {
        id: 'custom-message',
        label: 'Custom Message',
        content: '<span data-placeholder="message">{{message}}</span>',
        attributes: {
          class: 'gjs-block',
          title: 'Drag Custom Message'
        }
      }
    ]
  }
};

// Utility functions
const snap = v => Math.round(parseInt(v) / 20) * 20;
const applySnap = model => {
  if (!model || typeof model.getStyle !== 'function') return;
  
  const style = model.getStyle();
  if (!style) return;
  
  ['top', 'left', 'width', 'height'].forEach(p => {
    const val = parseInt(style[p]);
    if (!isNaN(val)) model.addStyle({ [p]: snap(val) + 'px' });
  });
};

// Helper function to configure blocks with absolute positioning and drag handles
const configureBlock = (block) => {
  return {
    ...block,
    content: block.content,
    attributes: {
      ...block.attributes,
      class: 'gjs-block',
      title: block.attributes?.title || 'Drag to add'
    },
    style: { 
      position: 'absolute', 
      cursor: 'move',
      'user-select': 'none'
    }
  };
};

export default function CanvasBuilder() {
  const editorRef = useRef(null);
  const [templates, setTemplates] = useState([]);

  // Initialize editor
  useEffect(() => {
    if (!editorRef.current) {
      const editor = grapesjs.init({
        ...EDITOR_CONFIG,
        dragMode: 'absolute',
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
              id: 'custom-message',
              label: 'Custom Message',
              content: '<span data-placeholder="custom_message">{{custom_message}}</span>',
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

      // Inject custom styles
      const styleEl = document.createElement('style');
      styleEl.textContent = customStyles;
      document.head.appendChild(styleEl);

      // Remove the panel after initialization
      const removePanel = () => {
        const panel = document.querySelector('.panel__right.gjs-pn-panel.gjs-pn-layers');
        if (panel) {
          panel.remove();
        }
      };
      
      // Remove panel immediately and after a short delay to ensure it's gone
      removePanel();
      setTimeout(removePanel, 100);

      // Add Page Background sector and configure wrapper
      const wrapper = editor.getWrapper();
      editor.StyleManager.addSector('page-background', {
        name: 'Page Background',
        open: true,
        buildProps: [
          'background-color',
          'background-image',
          'background-size',
          'background-position',
          'background-repeat'
        ],
      });

      // Configure background-image as asset type
      editor.StyleManager.addProperty('page-background', {
        property: 'background-image',
        type: 'asset',
        full: true,
        functionName: 'url',
        default: 'none',
      });

      // Show style panel for wrapper on load
      editor.on('load', () => editor.select(wrapper));

      // Setup event listeners
      editor.on('component:drag:end', applySnap);
      editor.on('component:resize:end', applySnap);
      editor.on('component:selected', handleComponentSelected);
      editor.on('component:add', (component) => {
        // Configure all components for dragging
        component.set({
          draggable: true,
          resizable: {
            handles: ['tl', 'tr', 'bl', 'br', 'ml', 'mr', 'mt', 'mb'],
            minWidth: 20,
            minHeight: 20
          },
          style: {
            position: 'absolute',
            cursor: 'move',
            'user-select': 'none'
          }
        });

        // Add drag handles
        component.set('traits', [
          {
            type: 'number',
            name: 'top',
            label: 'Top',
            default: 0,
          },
          {
            type: 'number',
            name: 'left',
            label: 'Left',
            default: 0,
          }
        ]);
      });

      // Register custom commands
      registerCustomCommands(editor);

      // Add custom commands for panels
      editor.Commands.add('show-layers', {
        run: (editor) => {
          const panel = editor.Panels.getPanel('layers');
          if (panel) panel.set('visible', true);
        },
        stop: (editor) => {
          const panel = editor.Panels.getPanel('layers');
          if (panel) panel.set('visible', false);
        }
      });

      editor.Commands.add('show-styles', {
        run: (editor) => {
          const panel = editor.Panels.getPanel('styles');
          if (panel) panel.set('visible', true);
        },
        stop: (editor) => {
          const panel = editor.Panels.getPanel('styles');
          if (panel) panel.set('visible', false);
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
            <div class="layout-root" 
                 style="position:relative;width:100%;height:100%;
                        display:flex;align-items:center;justify-content:center;">
            </div>
          `)[0];
          
          // Configure container for dragging
          container.set({
            draggable: true,
            resizable: true,
            selectable: true,
            hoverable: true,
            removable: false,
            copyable: false,
            style: {
              'min-height': '100%',
              'height': '100%',
              'margin': '0',
              'padding': '0',
              'position': 'relative'
            }
          });
          
          editor.select(container);
        }

        // Ensure body takes full height and allows dragging
        try {
          const doc = editor.getDocument();
          if (doc && doc.body) {
            doc.body.style.minHeight = '100%';
            doc.body.style.height = '100%';
            doc.body.style.margin = '0';
            doc.body.style.padding = '0';
            doc.body.style.position = 'relative';
          }
        } catch (error) {
          console.warn('Could not access editor document:', error);
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
    if (m.getAttributes && m.getAttributes()['data-placeholder'] === 'custom_message') {
      add('edit-msg', 'edit-custom-message', '✎');
    }
    m.set('toolbar', tb);
    
    // Enable dragging and resizing
    m.set('draggable', true);
    m.set('resizable', {
      handles: ['tl', 'tr', 'bl', 'br', 'ml', 'mr', 'mt', 'mb'],
      minWidth: 20,
      minHeight: 20
    });
    m.set('movable', true);
    
    // Add custom styles for drag handles
    m.addStyle({
      'cursor': 'move',
      'user-select': 'none'
    });
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
    editor.Commands.add('edit-custom-message', {
      run(ed) {
        const s = ed.getSelected();
        if (!s) return;
        const attrs = s.getAttributes && s.getAttributes();
        const current = attrs ? attrs['data-messages'] || '' : '';
        const value = prompt('Custom messages (comma separated)', current);
        if (value !== null) {
          s.addAttributes({ 'data-messages': value });
        }
      }
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
          <div className="panel__right"></div>
          <div id="style" className="canvas-builder__styles"></div>
        </div>
      </div>
    </div>
  );
}
