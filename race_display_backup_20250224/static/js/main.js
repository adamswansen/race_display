function startDisplay() {
    const form = document.getElementById('loginForm');
    const startButton = document.getElementById('startButton');
    const statusDiv = document.getElementById('status');
    
    // Disable the form and button
    form.querySelectorAll('input').forEach(input => input.disabled = true);
    startButton.disabled = true;
    startButton.textContent = 'Connecting...';
    
    // Show progress with more detailed message
    statusDiv.innerHTML = `
        <div class="alert alert-info">
            <h5>Connecting to Timing System</h5>
            <p class="mb-0">Please wait. Wait time can vary depending on the size of the race.</p>
        </div>
    `;
    
    const formData = new FormData();
    formData.append('user_id', document.getElementById('user-id').value);
    formData.append('password', document.getElementById('password').value);
    formData.append('event_id', document.getElementById('event-id').value);
    
    fetch('/api/login', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Instead of showing display, show customization
            document.getElementById('login-container').style.display = 'none';
            document.getElementById('customization-container').style.display = 'block';
            
            // Initialize preview with race name
            document.getElementById('preview-race-name').textContent = data.race_name;
            initializePreview();
        } else {
            // Error - re-enable form
            form.querySelectorAll('input').forEach(input => input.disabled = false);
            startButton.disabled = false;
            startButton.textContent = 'Start Display';
            
            statusDiv.innerHTML = `
                <div class="alert alert-danger">
                    <h4>Connection Failed</h4>
                    <p>Error: ${data.error}</p>
                </div>
            `;
        }
    })
    .catch(error => {
        console.error('Error:', error);
        statusDiv.innerHTML = `
            <div class="alert alert-danger">
                <h4>Connection Error</h4>
                <p>Please try again</p>
            </div>
        `;
        
        // Re-enable form on error
        form.querySelectorAll('input').forEach(input => input.disabled = false);
        startButton.disabled = false;
        startButton.textContent = 'Start Display';
    });
}

function initializeEventSource() {
    if (window.eventSource) {
        window.eventSource.close();
    }
    
    window.eventSource = new EventSource('/stream');
    
    window.eventSource.onmessage = (event) => {
        console.log('Received event:', event.data);
        try {
            const data = JSON.parse(event.data);
            
            if (!data.keepalive) {
                console.log('Updating display with:', data);
                // Get random message from custom or stock messages
                data.message = getRandomMessage();
                
                const runnerName = document.getElementById('runner-name');
                const runnerCity = document.getElementById('runner-city');
                const message = document.getElementById('message');
                
                // Update content while preserving styles
                runnerName.textContent = data.name || '';
                runnerCity.textContent = data.city || '';
                message.textContent = data.message;
                
                // Add animation
                const container = document.getElementById('participant-info');
                container.classList.add('animate');
                setTimeout(() => container.classList.remove('animate'), 2000);
            }
        } catch (error) {
            console.error('Error processing event:', error);
        }
    };

    window.eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        window.eventSource.close();
        setTimeout(initializeEventSource, 5000);
    };
}

// Clean up EventSource when page is unloaded
window.addEventListener('unload', () => {
    if (window.eventSource) {
        window.eventSource.close();
    }
});

// Update the themes object with more presets
const themes = {
    default: {
        name: 'Default',
        background: '#ffffff',
        text: '#000000',
        accent: '#007bff',
        backgroundImage: '',
        nameFont: 'Arial',
        nameSize: '48px',
        nameColor: '#000000',
        messageFont: 'Arial',
        messageSize: '24px',
        messageColor: '#000000',
        nameAlign: 'center',
        messageAlign: 'center'
    },
    modern: {
        name: 'Modern',
        background: '#2c3e50',
        text: '#ecf0f1',
        accent: '#3498db',
        backgroundImage: '',
        nameFont: "'Trebuchet MS'",
        nameSize: '64px',
        nameColor: '#ffffff',
        messageFont: 'Arial',
        messageSize: '32px',
        messageColor: '#e74c3c',
        nameAlign: 'center',
        messageAlign: 'center'
    },
    elegant: {
        name: 'Elegant',
        background: '#f5f5f5',
        text: '#2c3e50',
        accent: '#e74c3c',
        backgroundImage: '',
        nameFont: "'Times New Roman'",
        nameSize: '56px',
        nameColor: '#2c3e50',
        messageFont: "'Times New Roman'",
        messageSize: '28px',
        messageColor: '#7f8c8d',
        nameAlign: 'center',
        messageAlign: 'center'
    },
    energetic: {
        name: 'Energetic',
        background: '#2ecc71',
        text: '#ffffff',
        accent: '#f1c40f',
        backgroundImage: '',
        nameFont: 'Impact',
        nameSize: '72px',
        nameColor: '#ffffff',
        messageFont: 'Verdana',
        messageSize: '36px',
        messageColor: '#f1c40f',
        nameAlign: 'center',
        messageAlign: 'center'
    },
    minimalist: {
        name: 'Minimalist',
        background: '#ffffff',
        text: '#34495e',
        accent: '#95a5a6',
        backgroundImage: '',
        nameFont: 'Arial',
        nameSize: '48px',
        nameColor: '#34495e',
        messageFont: 'Arial',
        messageSize: '24px',
        messageColor: '#95a5a6',
        nameAlign: 'left',
        messageAlign: 'left'
    }
};

function initializeThemeControls() {
    const themeSelect = document.getElementById('theme-select');
    const customColors = document.getElementById('custom-colors');
    
    // Show/hide custom colors when theme changes
    themeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
            customColors.style.display = 'block';
        } else {
            customColors.style.display = 'none';
            applyTheme(themes[e.target.value]);
        }
    });
    
    // Handle background image upload
    document.getElementById('bg-image').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imageUrl = `url(${e.target.result})`;
                const container = document.getElementById('display-container');
                container.style.backgroundImage = imageUrl;
                
                // Save current theme with new background
                const theme = getCurrentThemeSettings();
                localStorage.setItem('displayTheme', JSON.stringify(theme));
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Add text customization handlers
    document.getElementById('name-size').addEventListener('input', (e) => {
        document.getElementById('name-size-value').textContent = e.target.value;
        document.getElementById('runner-name').style.fontSize = `${e.target.value}px`;
    });
    
    document.getElementById('message-size').addEventListener('input', (e) => {
        document.getElementById('message-size-value').textContent = e.target.value;
        document.getElementById('message').style.fontSize = `${e.target.value}px`;
    });
    
    ['name', 'message'].forEach(element => {
        document.getElementById(`${element}-font`).addEventListener('change', (e) => {
            document.getElementById(element === 'name' ? 'runner-name' : 'message').style.fontFamily = e.target.value;
        });
        
        document.getElementById(`${element}-color`).addEventListener('input', (e) => {
            document.getElementById(element === 'name' ? 'runner-name' : 'message').style.color = e.target.value;
        });
        
        // Add alignment handler
        document.getElementsByName(`${element}-align`).forEach(radio => {
            radio.addEventListener('change', (e) => {
                document.getElementById(element === 'name' ? 'runner-name' : 'message').style.textAlign = e.target.value;
            });
        });
    });
}

function previewTheme() {
    const theme = getCurrentThemeSettings();
    applyTheme(theme, true);
}

function saveTheme() {
    const theme = getCurrentThemeSettings();
    applyTheme(theme);
    localStorage.setItem('displayTheme', JSON.stringify(theme));
    
    // Hide settings and make display fullscreen
    document.getElementById('display-settings').style.display = 'none';
    
    // Add fullscreen class to container
    const container = document.getElementById('display-container');
    container.classList.add('fullscreen-display');
}

// Add a toggle settings function
function toggleSettings() {
    const settings = document.getElementById('display-settings');
    console.log('Toggling settings visibility:', settings.style.display);
    settings.style.display = settings.style.display === 'none' ? 'block' : 'none';
}

function getCurrentThemeSettings() {
    // Get the current theme from localStorage or use default
    let currentTheme = themes.default;  // Default fallback
    const savedTheme = localStorage.getItem('displayTheme');
    if (savedTheme) {
        currentTheme = JSON.parse(savedTheme);
    }
    
    // Get current text settings
    const textSettings = {
        nameFont: document.getElementById('name-font').value,
        nameSize: `${document.getElementById('name-size').value}px`,
        nameColor: document.getElementById('name-color').value,
        messageFont: document.getElementById('message-font').value,
        messageSize: `${document.getElementById('message-size').value}px`,
        messageColor: document.getElementById('message-color').value,
        nameAlign: document.querySelector('input[name="name-align"]:checked').value,
        messageAlign: document.querySelector('input[name="message-align"]:checked').value
    };

    // Get background image if exists
    const container = document.getElementById('display-container');
    const currentBgImage = container.style.backgroundImage || '';

    // Check if custom colors are being used
    const customColors = document.getElementById('custom-colors');
    if (customColors && customColors.style.display !== 'none') {
        return {
            background: document.getElementById('bg-color').value,
            text: document.getElementById('text-color').value,
            accent: document.getElementById('accent-color').value,
            backgroundImage: currentBgImage,
            ...textSettings
        };
    }

    // Return current theme with any custom text settings
    return {
        ...currentTheme,
        backgroundImage: currentBgImage,
        ...textSettings
    };
}

function applyTheme(theme, isPreview = false) {
    const container = document.getElementById('display-container');
    const runnerName = document.getElementById('runner-name');
    const message = document.getElementById('message');
    
    const style = `
        background-color: ${theme.background};
        color: ${theme.text};
        ${theme.backgroundImage ? `background-image: ${theme.backgroundImage};` : ''}
    `;
    
    if (isPreview) {
        container.setAttribute('data-preview-style', style);
        setTimeout(() => container.removeAttribute('data-preview-style'), 3000);
    } else {
        container.style = style;
        document.documentElement.style.setProperty('--accent-color', theme.accent);
        
        // Apply text styles
        runnerName.style.fontFamily = theme.nameFont;
        runnerName.style.fontSize = theme.nameSize;
        runnerName.style.color = theme.nameColor;
        
        message.style.fontFamily = theme.messageFont;
        message.style.fontSize = theme.messageSize;
        message.style.color = theme.messageColor;
        
        // Apply alignments
        runnerName.style.textAlign = theme.nameAlign;
        message.style.textAlign = theme.messageAlign;
        
        // Update radio buttons to match theme
        document.querySelector(`input[name="name-align"][value="${theme.nameAlign}"]`).checked = true;
        document.querySelector(`input[name="message-align"][value="${theme.messageAlign}"]`).checked = true;
    }
}

// Update global variables
let MAX_QUEUE_SIZE = 50; // Now let instead of const so we can change it

function initializePreview() {
    // Get preview elements
    const previewElements = {
        name: document.getElementById('preview-runner-name'),
        message: document.getElementById('preview-message'),
        container: document.getElementById('preview-display'),
        participantInfo: document.getElementById('preview-participant-info')
    };
    
    // Update preview in real-time as settings change
    ['name', 'message'].forEach(element => {
        // Font changes
        document.getElementById(`${element}-font`).addEventListener('change', (e) => {
            previewElements[element].style.fontFamily = e.target.value;
        });
        
        // Size changes
        document.getElementById(`${element}-size`).addEventListener('input', (e) => {
            previewElements[element].style.fontSize = `${e.target.value}px`;
            document.getElementById(`${element}-size-value`).textContent = e.target.value;
        });
        
        // Color changes
        document.getElementById(`${element}-color`).addEventListener('input', (e) => {
            previewElements[element].style.color = e.target.value;
        });
        
        // Alignment changes
        document.getElementsByName(`${element}-align`).forEach(radio => {
            radio.addEventListener('change', (e) => {
                previewElements[element].style.textAlign = e.target.value;
            });
        });
    });
    
    // Background color changes
    document.getElementById('bg-color')?.addEventListener('input', (e) => {
        previewElements.container.style.backgroundColor = e.target.value;
    });
    
    // Text color changes
    document.getElementById('text-color')?.addEventListener('input', (e) => {
        previewElements.container.style.color = e.target.value;
    });
    
    // Background image changes
    document.getElementById('bg-image')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imageUrl = `url(${e.target.result})`;
                previewElements.container.style.backgroundImage = imageUrl;
                previewElements.container.style.backgroundSize = 'cover';
                previewElements.container.style.backgroundPosition = 'center';
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Set initial preview content
    previewElements.name.textContent = "John Smith";
    previewElements.message.textContent = "You're crushing it! 💪";
    
    // Apply initial theme
    const savedTheme = localStorage.getItem('displayTheme');
    if (savedTheme) {
        applyTheme(JSON.parse(savedTheme), true);
    } else {
        applyTheme(themes.default, true);
    }

    // Logo upload handling
    document.getElementById('logo-upload').addEventListener('change', handleLogoUpload);
    
    // Logo position handling
    document.getElementsByName('logo-position').forEach(radio => {
        radio.addEventListener('change', updateLogoPosition);
    });

    // Initialize logo controls
    initializeLogoControls();

    initializeMessageControls();

    // Initialize queue size control
    const queueSizeSlider = document.getElementById('queue-size');
    const queueSizeValue = document.getElementById('queue-size-value');
    
    // Load saved queue size
    const savedQueueSize = localStorage.getItem('queueSize');
    if (savedQueueSize) {
        MAX_QUEUE_SIZE = parseInt(savedQueueSize);
        queueSizeSlider.value = MAX_QUEUE_SIZE;
        queueSizeValue.textContent = MAX_QUEUE_SIZE;
    }
    
    queueSizeSlider.addEventListener('input', (e) => {
        MAX_QUEUE_SIZE = parseInt(e.target.value);
        queueSizeValue.textContent = MAX_QUEUE_SIZE;
        localStorage.setItem('queueSize', MAX_QUEUE_SIZE);
        
        // If current queue is larger than new size, trim it
        if (messageQueue.length > MAX_QUEUE_SIZE) {
            const removed = messageQueue.length - MAX_QUEUE_SIZE;
            messageQueue = messageQueue.slice(-MAX_QUEUE_SIZE);
            console.log(`Queue size reduced. Removed ${removed} oldest entries.`);
            updateQueueStatus();
        }
    });
}

function initializeLogoControls() {
    const dropZone = document.getElementById('logo-drop-zone');
    const logoSize = document.getElementById('logo-size');
    const logoOpacity = document.getElementById('logo-opacity');
    
    if (!dropZone) {
        console.error('Drop zone not found');
        return;
    }
    
    console.log('Initializing logo controls');
    
    // File input handling
    const fileInput = dropZone.querySelector('input[type="file"]');
    if (fileInput) {
        fileInput.addEventListener('change', handleLogoUpload);
    }
    
    // Drag and drop handling
    dropZone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
        
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleLogoUpload({ target: { files: [file] } });
        }
    });
}

function updateLogoSize(size) {
    document.documentElement.style.setProperty('--logo-size', `${size}px`);
    localStorage.setItem('logoSize', size);
}

function updateLogoOpacity(opacity) {
    document.documentElement.style.setProperty('--logo-opacity', opacity);
    localStorage.setItem('logoOpacity', opacity);
}

function handleLogoUpload(event) {
    console.log('Logo upload triggered', event);
    const file = event.target.files[0] || event.dataTransfer?.files[0];
    if (!file) {
        console.log('No file selected');
        return;
    }
    console.log('Processing file:', file);

    const reader = new FileReader();
    reader.onload = function(e) {
        console.log('File read complete');
        const img = new Image();
        img.onload = function() {
            console.log('Image loaded, dimensions:', img.width, 'x', img.height);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Get current size setting
            const size = document.getElementById('logo-size').value;
            let width = size;
            let height = size;
            
            // Maintain aspect ratio
            if (img.width > img.height) {
                height = (img.height / img.width) * size;
            } else {
                width = (img.width / img.height) * size;
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            const scaledImage = canvas.toDataURL('image/png');
            console.log('Image scaled and converted');
            
            // Apply to preview and live display
            const previewLogo = document.getElementById('preview-event-logo');
            const displayLogo = document.getElementById('event-logo');
            
            console.log('Applying to elements:', { previewLogo, displayLogo });
            
            [previewLogo, displayLogo].forEach(logo => {
                if (logo) {
                    logo.style.backgroundImage = `url(${scaledImage})`;
                    logo.style.width = `${width}px`;
                    logo.style.height = `${height}px`;
                    // Add default position if none set
                    if (!logo.classList.contains('top-left') && 
                        !logo.classList.contains('top-right') && 
                        !logo.classList.contains('bottom-left') && 
                        !logo.classList.contains('bottom-right')) {
                        logo.classList.add('top-right');
                    }
                }
            });
            
            // Save settings
            localStorage.setItem('eventLogo', scaledImage);
            localStorage.setItem('logoWidth', width);
            localStorage.setItem('logoHeight', height);
            console.log('Settings saved');
        };
        img.src = e.target.result;
    };
    
    reader.onerror = function(error) {
        console.error('Error reading file:', error);
    };
    
    reader.readAsDataURL(file);
}

function updateLogoPosition(event) {
    const position = event.target.value;
    const previewLogo = document.getElementById('preview-display').querySelector('.event-logo');
    const displayLogo = document.getElementById('display-container').querySelector('.event-logo');
    
    // Remove all position classes
    ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach(pos => {
        previewLogo.classList.remove(pos);
        displayLogo.classList.remove(pos);
    });
    
    // Add new position class
    previewLogo.classList.add(position);
    displayLogo.classList.add(position);
    
    // Save position preference
    localStorage.setItem('logoPosition', position);
}

function backToLogin() {
    document.getElementById('customization-container').style.display = 'none';
    document.getElementById('login-container').style.display = 'block';
    // Reset form if needed
}

function startLiveDisplay() {
    console.log('Starting live display...');
    
    try {
        // 1. Check if required elements exist
        const requiredElements = {
            customization: document.getElementById('customization-container'),
            display: document.getElementById('display-container'),
            raceName: document.getElementById('race-name'),
            previewRaceName: document.getElementById('preview-race-name'),
            runnerName: document.getElementById('runner-name'),
            runnerCity: document.getElementById('runner-city'),
            message: document.getElementById('message'),
            participantInfo: document.getElementById('participant-info')
        };

        // Check each element exists
        Object.entries(requiredElements).forEach(([name, element]) => {
            if (!element) {
                throw new Error(`Required element not found: ${name}`);
            }
            console.log(`Found ${name} element`);
        });

        // 2. Get and validate theme settings
        const currentTheme = getCurrentThemeSettings();
        console.log('Current theme:', currentTheme);
        if (!currentTheme) {
            throw new Error('Failed to get current theme settings');
        }
        localStorage.setItem('displayTheme', JSON.stringify(currentTheme));

        // 3. Set up display container
        console.log('Setting up display container...');
        requiredElements.customization.style.display = 'none';
        requiredElements.display.style.display = 'block';

        // 4. Apply styles
        console.log('Applying styles...');
        try {
            Object.assign(requiredElements.display.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100vw',
                height: '100vh',
                zIndex: '9999',
                backgroundColor: currentTheme.background,
                color: currentTheme.text,
                backgroundImage: currentTheme.backgroundImage || 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                padding: '0',
                margin: '0',
                overflow: 'hidden'
            });
            console.log('Display container styles applied');
        } catch (styleError) {
            throw new Error(`Failed to apply display styles: ${styleError.message}`);
        }

        // 5. Style participant info
        console.log('Styling participant info...');
        try {
            Object.assign(requiredElements.participantInfo.style, {
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '80%',
                maxWidth: '1200px'
            });
            console.log('Participant info styles applied');
        } catch (styleError) {
            throw new Error(`Failed to apply participant info styles: ${styleError.message}`);
        }

        // 6. Copy race name
        console.log('Copying race name...');
        requiredElements.raceName.textContent = requiredElements.previewRaceName.textContent;

        // 7. Apply text styles
        console.log('Applying text styles...');
        try {
            Object.assign(requiredElements.runnerName.style, {
                fontFamily: currentTheme.nameFont,
                fontSize: currentTheme.nameSize,
                color: currentTheme.nameColor,
                textAlign: currentTheme.nameAlign
            });

            Object.assign(requiredElements.message.style, {
                fontFamily: currentTheme.messageFont,
                fontSize: currentTheme.messageSize,
                color: currentTheme.messageColor,
                textAlign: currentTheme.messageAlign
            });
            console.log('Text styles applied');
        } catch (styleError) {
            throw new Error(`Failed to apply text styles: ${styleError.message}`);
        }

        // 8. Request fullscreen
        console.log('Requesting fullscreen...');
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(e => {
                console.warn('Fullscreen request failed:', e);
                // Continue even if fullscreen fails
            });
        }

        // 9. Set up event source
        console.log('Setting up event source...');
        if (window.eventSource) {
            console.log('Closing existing event source');
            window.eventSource.close();
        }

        window.eventSource = new EventSource('/stream');
        console.log('Event source created');

        window.eventSource.onopen = function() {
            console.log('EventSource connection opened');
            // Start with waiting animation
            showWaitingAnimation();
        };

        // Add the updated message handler here
        window.eventSource.onmessage = function(event) {
            console.log('Received event:', event.data);
            try {
                const data = JSON.parse(event.data);
                if (!data.keepalive) {
                    data.message = getRandomMessage();
                    
                    if (isDisplaying) {
                        if (messageQueue.length >= MAX_QUEUE_SIZE) {
                            console.warn(`Queue full (${messageQueue.length} items). Dropping oldest entry.`);
                            messageQueue.shift(); // Remove oldest entry
                        }
                        messageQueue.push(data);
                        console.log('Added to queue, current length:', messageQueue.length);
                    } else {
                        displayRunnerInfo(data);
                    }
                }
            } catch (error) {
                console.error('Error processing event:', error);
            }
        };

        window.eventSource.onerror = function(error) {
            console.error('EventSource error:', error);
            setTimeout(() => {
                if (window.eventSource) {
                    window.eventSource.close();
                    startLiveDisplay();
                }
            }, 5000);
        };

        // Apply logo if exists
        const savedLogo = localStorage.getItem('eventLogo');
        const savedPosition = localStorage.getItem('logoPosition') || 'top-right';
        const savedSize = localStorage.getItem('logoSize') || '350';
        const savedOpacity = localStorage.getItem('logoOpacity') || '100';
        
        if (savedLogo) {
            const displayLogo = requiredElements.display.querySelector('.event-logo');
            displayLogo.style.backgroundImage = `url(${savedLogo})`;
            displayLogo.classList.add(savedPosition);
            updateLogoSize(savedSize);
            updateLogoOpacity(savedOpacity / 100);
        }

        console.log('Live display started successfully');
    } catch (error) {
        console.error('Error in startLiveDisplay:', error);
        alert('Error starting live display. Check console for details.');
    }
}

// Add fullscreen change handler
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('mozfullscreenchange', handleFullscreenChange);
document.addEventListener('MSFullscreenChange', handleFullscreenChange);

function handleFullscreenChange() {
    const displayContainer = document.getElementById('display-container');
    if (!document.fullscreenElement && 
        !document.webkitFullscreenElement && 
        !document.mozFullScreenElement && 
        !document.msFullscreenElement) {
        // Exited fullscreen
        console.log('Exited fullscreen mode');
        displayContainer.classList.remove('fullscreen-display');
    }
}

function applyTemplate(templateName) {
    const theme = themes[templateName];
    if (!theme) return;
    
    // Update all form controls to match template
    document.getElementById('name-font').value = theme.nameFont;
    document.getElementById('name-size').value = parseInt(theme.nameSize);
    document.getElementById('name-color').value = theme.nameColor;
    document.getElementById('message-font').value = theme.messageFont;
    document.getElementById('message-size').value = parseInt(theme.messageSize);
    document.getElementById('message-color').value = theme.messageColor;
    
    // Update alignments
    document.querySelector(`input[name="name-align"][value="${theme.nameAlign}"]`).checked = true;
    document.querySelector(`input[name="message-align"][value="${theme.messageAlign}"]`).checked = true;
    
    // Apply to preview immediately
    const previewElements = {
        name: document.getElementById('preview-runner-name'),
        message: document.getElementById('preview-message'),
        container: document.getElementById('preview-display'),
        participantInfo: document.getElementById('preview-participant-info')
    };
    
    // Apply styles to preview
    previewElements.container.style.backgroundColor = theme.background;
    previewElements.container.style.color = theme.text;
    
    previewElements.name.style.fontFamily = theme.nameFont;
    previewElements.name.style.fontSize = theme.nameSize;
    previewElements.name.style.color = theme.nameColor;
    previewElements.name.style.textAlign = theme.nameAlign;
    
    previewElements.message.style.fontFamily = theme.messageFont;
    previewElements.message.style.fontSize = theme.messageSize;
    previewElements.message.style.color = theme.messageColor;
    previewElements.message.style.textAlign = theme.messageAlign;
    
    // Hide custom options if not custom template
    document.getElementById('custom-colors').style.display = templateName === 'custom' ? 'block' : 'none';
}

function showCustomOptions() {
    document.getElementById('custom-colors').style.display = 'block';
}

// Add cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.eventSource) {
        console.log('Closing event source before unload');
        window.eventSource.close();
    }
});

// Add to global variables at top
let customMessages = [];
const stockMessages = [
    "You're crushing it! 💪",
    "Looking strong! 🏃‍♂️",
    "Keep pushing! 🔥",
    "Almost there! ⭐",
    "You've got this! 🎯",
    "Incredible pace! 🚀",
    "Way to go! 🌟",
    "Outstanding effort! 💫"
];

function initializeMessageControls() {
    const uploadZone = document.getElementById('message-upload-zone');
    const fileInput = document.getElementById('message-upload');
    
    // Load saved messages
    const savedMessages = localStorage.getItem('customMessages');
    if (savedMessages) {
        customMessages = JSON.parse(savedMessages);
        updateMessageList();
    }
    
    fileInput.addEventListener('change', handleMessageFileUpload);
    
    // Drag and drop for message file
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.add('drag-over');
    });
    
    uploadZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.remove('drag-over');
    });
    
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.remove('drag-over');
        
        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.txt') || file.name.endsWith('.csv'))) {
            handleMessageFileUpload({ target: { files: [file] } });
        }
    });
}

function handleMessageFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check file size (max 1MB)
    if (file.size > 1024 * 1024) {
        alert('File is too large. Please keep it under 1MB.');
        return;
    }
    
    // Check file type
    if (!file.name.match(/\.(txt|csv)$/i)) {
        alert('Please upload a .txt or .csv file');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            // Split by newline and filter out empty lines
            const messages = content.split(/\r?\n/)
                .map(msg => msg.trim())
                .filter(msg => msg.length > 0);
            
            // Validate messages
            if (messages.length === 0) {
                throw new Error('No valid messages found in file');
            }
            
            // Check each message
            const invalidMessages = messages.filter(msg => msg.length > 200);
            if (invalidMessages.length > 0) {
                throw new Error('Some messages are too long (max 200 characters)');
            }
            
            // Preview messages before saving
            const previewDialog = confirm(
                `Found ${messages.length} messages. Here are the first 3:\n\n` +
                messages.slice(0, 3).join('\n') +
                `\n\nWould you like to use these messages?`
            );
            
            if (previewDialog) {
                customMessages = messages;
                localStorage.setItem('customMessages', JSON.stringify(customMessages));
                updateMessageList();
                alert(`Successfully loaded ${messages.length} messages`);
            }
        } catch (error) {
            console.error('Error processing messages:', error);
            alert(`Error processing messages: ${error.message}`);
        }
    };
    
    reader.onerror = function(error) {
        console.error('Error reading file:', error);
        alert('Error reading file. Please try again.');
    };
    
    reader.readAsText(file);
}

function updateMessageList() {
    const container = document.getElementById('message-list-container');
    const list = document.getElementById('message-list');
    
    if (customMessages.length > 0) {
        container.style.display = 'block';
        const messageCount = `<div class="small text-muted mb-2">
            ${customMessages.length} custom message${customMessages.length === 1 ? '' : 's'}
        </div>`;
        
        // Add preview functionality
        list.innerHTML = messageCount + customMessages.map((msg, index) => `
            <div class="message-item">
                <span class="message-text">${msg}</span>
                <div class="message-actions">
                    <button class="btn btn-sm btn-outline-primary" onclick="previewMessage(${index})" title="Preview">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="editMessage(${index})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteMessage(${index})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } else {
        container.style.display = 'block';
        list.innerHTML = `
            <div class="text-muted text-center p-3">
                <p>No custom messages. Using ${stockMessages.length} stock messages.</p>
                <small>Upload a file or add messages manually to customize.</small>
                <div class="mt-2">
                    <button class="btn btn-sm btn-outline-primary" onclick="previewStockMessages()">
                        Preview Stock Messages
                    </button>
                </div>
            </div>
        `;
    }
}

function addCustomMessage() {
    const message = prompt('Enter new message (max 200 characters):');
    if (message?.trim()) {
        if (message.length > 200) {
            alert('Message is too long. Please keep it under 200 characters.');
            return;
        }
        customMessages.push(message.trim());
        localStorage.setItem('customMessages', JSON.stringify(customMessages));
        updateMessageList();
    }
}

function editMessage(index) {
    const message = prompt('Edit message (max 200 characters):', customMessages[index]);
    if (message?.trim()) {
        if (message.length > 200) {
            alert('Message is too long. Please keep it under 200 characters.');
            return;
        }
        customMessages[index] = message.trim();
        localStorage.setItem('customMessages', JSON.stringify(customMessages));
        updateMessageList();
    }
}

function deleteMessage(index) {
    if (confirm('Delete this message?')) {
        customMessages.splice(index, 1);
        localStorage.setItem('customMessages', JSON.stringify(customMessages));
        updateMessageList();
    }
}

function downloadMessages() {
    const content = customMessages.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'custom_messages.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Update the event source message handling to use custom or stock messages
function getRandomMessage() {
    const messages = customMessages.length > 0 ? customMessages : stockMessages;
    return messages[Math.floor(Math.random() * messages.length)];
}

// Add preview functions
function previewMessage(index) {
    const message = customMessages[index];
    document.getElementById('preview-message').textContent = message;
}

function previewStockMessages() {
    // Show stock messages in a modal or alert
    alert('Stock Messages:\n\n' + stockMessages.join('\n'));
}

// Update global variables
const DISPLAY_DURATION = 5000;

// Update animation configurations with more options
const animations = {
    transitions: [
        {
            in: 'animate__animated animate__fadeInUp',
            out: 'animate__animated animate__fadeOutDown'
        },
        {
            in: 'animate__animated animate__bounceInRight',
            out: 'animate__animated animate__bounceOutLeft'
        },
        {
            in: 'animate__animated animate__flipInX',
            out: 'animate__animated animate__flipOutX'
        },
        {
            in: 'animate__animated animate__zoomIn',
            out: 'animate__animated animate__zoomOut'
        }
    ],
    waiting: [
        {
            classes: 'animate__animated animate__pulse animate__infinite',
            text: "Waiting for next runner... 🏃‍♂️"
        },
        {
            classes: 'animate__animated animate__bounce animate__infinite',
            text: "Ready for next finisher! 🎉"
        },
        {
            classes: 'animate__animated animate__swing animate__infinite',
            text: "Who's next? 🤔"
        }
    ]
};

// Update displayRunnerInfo to use random transitions
function displayRunnerInfo(data) {
    isDisplaying = true;
    const container = document.getElementById('participant-info');
    const runnerName = document.getElementById('runner-name');
    const runnerCity = document.getElementById('runner-city');
    const message = document.getElementById('message');

    // Pick random transition
    const transition = animations.transitions[
        Math.floor(Math.random() * animations.transitions.length)
    ];

    // Add exit animation to current content
    container.className = transition.out;
    
    setTimeout(() => {
        // Update content
        runnerName.textContent = data.name || '';
        runnerCity.textContent = data.city || '';
        message.textContent = data.message;
        
        // Add entrance animation
        container.className = transition.in;
        
        setTimeout(() => {
            isDisplaying = false;
            
            if (messageQueue.length > 0) {
                const nextData = messageQueue.shift();
                displayRunnerInfo(nextData);
            } else {
                showWaitingAnimation();
            }
        }, DISPLAY_DURATION);
    }, 750); // Slightly longer for more complex animations
}

// Update showWaitingAnimation to use random waiting states
function showWaitingAnimation() {
    const container = document.getElementById('participant-info');
    const runnerName = document.getElementById('runner-name');
    const runnerCity = document.getElementById('runner-city');
    const message = document.getElementById('message');

    // Pick random waiting animation
    const waiting = animations.waiting[
        Math.floor(Math.random() * animations.waiting.length)
    ];

    // Add exit animation
    container.className = animations.transitions[0].out;
    
    setTimeout(() => {
        // Clear content
        runnerName.textContent = '';
        runnerCity.textContent = '';
        message.textContent = waiting.text;
        
        // Add waiting animation
        container.className = waiting.classes;
    }, 500);
}

// Update the queue status display to show max size
function updateQueueStatus() {
    const container = document.getElementById('display-container');
    let queueStatus = container.querySelector('.queue-status');
    
    if (messageQueue.length > 0) {
        if (!queueStatus) {
            queueStatus = document.createElement('div');
            queueStatus.className = 'queue-status';
            container.appendChild(queueStatus);
        }
        queueStatus.textContent = `${messageQueue.length}/${MAX_QUEUE_SIZE} runners in queue`;
    } else if (queueStatus) {
        queueStatus.remove();
    }
}