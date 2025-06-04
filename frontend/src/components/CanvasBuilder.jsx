import React, { useEffect, useRef } from 'react';
import grapesjs from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';

export default function CanvasBuilder() {
  const editorRef = useRef(null);

  useEffect(() => {
    if (!editorRef.current) {
      editorRef.current = grapesjs.init({
        container: '#gjs',
        height: '600px',
        storageManager: false,
        panels: { defaults: [] },
        blockManager: {
          appendTo: '#blocks',
          blocks: [
            {
              id: 'bib',
              label: 'Bib Number',
              content: '<div class="bib-number">1234</div>',
            },
            {
              id: 'name',
              label: 'Name',
              content: '<div class="runner-name">Runner Name</div>',
            },
            {
              id: 'city',
              label: 'City/State',
              content: '<div class="runner-city">City, ST</div>',
            },
            {
              id: 'logo',
              label: 'Logo',
              content: '<img src="/static/images/logo.png" alt="Logo" />',
            }
          ]
        }
      });
    }
  }, []);

  return (
    <div className="row">
      <div id="blocks" className="col-2"></div>
      <div id="gjs" className="col"></div>
    </div>
  );
}
