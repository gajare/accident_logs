document.addEventListener('DOMContentLoaded', function() {
    // Configuration
    const API_BASE_URL = 'http://localhost:8080'; // Backend server URL
    
    // DOM elements
    const getAuthBtn = document.getElementById('getAuthBtn');
    const getTokenBtn = document.getElementById('getTokenBtn');
    const authCodeInput = document.getElementById('authCode');
    const tokenDisplay = document.getElementById('tokenDisplay');
    const refreshLogsBtn = document.getElementById('refreshLogsBtn');
    const logsList = document.getElementById('logsList');
    const createLogForm = document.getElementById('createLogForm');

    // Current access token
    let accessToken = localStorage.getItem('procoreAccessToken') || '';
    if (accessToken) {
        tokenDisplay.textContent = `Current Token: ${accessToken}`;
    }

    // Event listeners
    getAuthBtn.addEventListener('click', getAuthorizationCode);
    getTokenBtn.addEventListener('click', getAccessToken);
    refreshLogsBtn.addEventListener('click', fetchAccidentLogs);
    createLogForm.addEventListener('submit', handleCreateLog);

    // Utility function for loading states
    function setLoading(element, isLoading) {
        if (isLoading) {
            element.classList.add('loading');
            element.disabled = true;
            element.innerHTML = element.innerHTML + ' <span class="spinner"></span>';
        } else {
            element.classList.remove('loading');
            element.disabled = false;
            element.innerHTML = element.innerHTML.replace(' <span class="spinner"></span>', '');
        }
    }

    // Get authorization code
    function getAuthorizationCode() {
        const clientId = '_DKvGlwYKsqe9QxBhZ00eZ9RmmOKd8dzyovUKxVL510';
        const authUrl = `https://login-sandbox.procore.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=urn:ietf:wg:oauth:2.0:oob`;
        window.open(authUrl, '_blank');
    }

    // Get access token
    function getAccessToken() {
        const code = authCodeInput.value.trim();
        if (!code) {
            alert('Please enter the authorization code');
            return;
        }

        setLoading(getTokenBtn, true);

        fetch(`${API_BASE_URL}/api/auth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code: code })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.error || 'Failed to get access token');
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.access_token) {
                accessToken = data.access_token;
                localStorage.setItem('procoreAccessToken', accessToken);
                tokenDisplay.textContent = `Current Token: ${accessToken}`;
                authCodeInput.value = '';
                fetchAccidentLogs();
            } else {
                throw new Error('No access token received');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showError(`Error getting access token: ${error.message}\n\nPossible solutions:\n1. Verify the authorization code is correct\n2. Check the backend server is running\n3. Ensure your network connection is stable`);
        })
        .finally(() => {
            setLoading(getTokenBtn, false);
        });
    }

    // Fetch accident logs
    function fetchAccidentLogs() {
        if (!accessToken) {
            showError('Please get an access token first');
            return;
        }

        setLoading(refreshLogsBtn, true);
        logsList.innerHTML = '<div class="loading-message">Loading accident logs...</div>';

        fetch(`${API_BASE_URL}/api/accident-logs`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.error || 'Failed to fetch accident logs');
                });
            }
            return response.json();
        })
        .then(logs => {
            displayAccidentLogs(logs);
        })
        .catch(error => {
            console.error('Error:', error);
            logsList.innerHTML = `<div class="error-message">${error.message}</div>`;
            showError(`Error fetching accident logs: ${error.message}`);
        })
        .finally(() => {
            setLoading(refreshLogsBtn, false);
        });
    }

    // Display accident logs
    function displayAccidentLogs(logs) {
        logsList.innerHTML = '';
        
        if (!logs || logs.length === 0) {
            logsList.innerHTML = '<div class="no-logs">No accident logs found</div>';
            return;
        }

        logs.forEach(log => {
            const logElement = document.createElement('div');
            logElement.className = 'log-item';
            logElement.innerHTML = `
                <h3>Log #${log.id}</h3>
                <p><strong>Date:</strong> ${formatDate(log.date)}</p>
                <p><strong>Time:</strong> ${log.time_hour}:${log.time_minute.toString().padStart(2, '0')}</p>
                <p><strong>Involved:</strong> ${log.involved_name} (${log.involved_company})</p>
                <p><strong>Comments:</strong> ${log.comments || 'N/A'}</p>
                <button class="delete-btn" data-id="${log.id}">Delete Log</button>
            `;
            logsList.appendChild(logElement);
        });

        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', function() {
                const logId = this.getAttribute('data-id');
                deleteAccidentLog(logId);
            });
        });
    }

    // Delete accident log
    function deleteAccidentLog(logId) {
        if (!accessToken) {
            showError('Please get an access token first');
            return;
        }

        if (!confirm('Are you sure you want to delete this log? This action cannot be undone.')) {
            return;
        }

        fetch(`${API_BASE_URL}/api/accident-logs/${logId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.error || 'Failed to delete accident log');
                });
            }
            return response.json();
        })
        .then(() => {
            showSuccess('Log deleted successfully');
            fetchAccidentLogs();
        })
        .catch(error => {
            console.error('Error:', error);
            showError(`Error deleting accident log: ${error.message}`);
        });
    }

    // Handle create log form submission
    function handleCreateLog(e) {
        e.preventDefault();
        
        if (!accessToken) {
            showError('Please get an access token first');
            return;
        }

        const formData = {
            comments: document.getElementById('comments').value,
            date: document.getElementById('date').value,
            datetime: document.getElementById('datetime').value,
            involvedCompany: document.getElementById('involvedCompany').value,
            involvedName: document.getElementById('involvedName').value,
            timeHour: parseInt(document.getElementById('timeHour').value),
            timeMinute: parseInt(document.getElementById('timeMinute').value)
        };

        // Basic validation
        if (!formData.date || !formData.involvedCompany || !formData.involvedName) {
            showError('Please fill in all required fields');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        setLoading(submitBtn, true);

        fetch(`${API_BASE_URL}/api/accident-logs`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.error || 'Failed to create accident log');
                });
            }
            return response.json();
        })
        .then(() => {
            showSuccess('Log created successfully');
            createLogForm.reset();
            fetchAccidentLogs();
        })
        .catch(error => {
            console.error('Error:', error);
            showError(`Error creating accident log: ${error.message}`);
        })
        .finally(() => {
            setLoading(submitBtn, false);
        });
    }

    // Helper functions
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }

    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    function showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }

    // Initial fetch if we already have a token
    if (accessToken) {
        fetchAccidentLogs();
    }
});