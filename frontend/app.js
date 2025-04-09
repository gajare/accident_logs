document.addEventListener('DOMContentLoaded', function() {
    const API_BASE_URL = 'http://localhost:8080';
    let accessToken = localStorage.getItem('procoreAccessToken') || '';

    // DOM elements
    const getAuthBtn = document.getElementById('getAuthBtn');
    const getTokenBtn = document.getElementById('getTokenBtn');
    const authCodeInput = document.getElementById('authCode');
    const tokenStatus = document.getElementById('tokenStatus');
    const refreshLogsBtn = document.getElementById('refreshLogsBtn');
    const logsList = document.getElementById('logsList');
    const createLogForm = document.getElementById('createLogForm');
    const fromDateInput = document.getElementById('fromDate');
    const toDateInput = document.getElementById('toDate');
    const filterLogsBtn = document.getElementById('filterLogsBtn');
    const clearFilterBtn = document.getElementById('clearFilterBtn');

    // Update token status display
    function updateTokenStatus() {
        tokenStatus.textContent = accessToken ? '✔ Token available' : '✖ No token';
        tokenStatus.className = accessToken ? 'token-valid' : 'token-invalid';
    }

    // Initialize
    updateTokenStatus();

    // Event listeners
    getAuthBtn.addEventListener('click', getAuthorizationCode);
    getTokenBtn.addEventListener('click', getAccessToken);
    refreshLogsBtn.addEventListener('click', () => fetchAccidentLogs());
    filterLogsBtn.addEventListener('click', applyDateFilter);
    clearFilterBtn.addEventListener('click', clearDateFilter);
    createLogForm.addEventListener('submit', handleCreateLog);

    // Get authorization code
    function getAuthorizationCode() {
        const clientId = '_DKvGlwYKsqe9QxBhZ00eZ9RmmOKd8dzyovUKxVL510';
        const authUrl = `https://login-sandbox.procore.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=urn:ietf:wg:oauth:2.0:oob`;
        window.open(authUrl, '_blank');
    }

    // Handles errors from fetch calls
    function handleError(error) {
        console.error('API Error:', error);
        // Show the actual error message if available
        const message = error.response?.data?.error || error.message || 'An unexpected error occurred';
        showError(message);
    }

    // Formats time into "HH:MM" format
    function formatTime(hour, minute) {
        const hh = String(hour).padStart(2, '0');
        const mm = String(minute).padStart(2, '0');
        return `${hh}:${mm}`;
    }

    // Loading state toggle for buttons
    function setLoading(button, isLoading) {
        if (isLoading) {
            button.disabled = true;
            button.dataset.originalText = button.textContent;
            button.textContent = 'Loading...';
        } else {
            button.disabled = false;
            if (button.dataset.originalText) {
                button.textContent = button.dataset.originalText;
                delete button.dataset.originalText;
            }
        }
    }

    // Handles HTTP responses
    function handleResponse(response) {
        if (!response.ok) {
            return response.json().then(errorData => {
                const error = errorData.error || 'An error occurred while processing the request';
                throw new Error(error);
            });
        }
        return response.json();
    }
    
    // Get access token
    function getAccessToken() {
        const code = authCodeInput.value.trim();
        if (!code) {
            showError('Please enter the authorization code');
            return;
        }

        setLoading(getTokenBtn, true);

        fetch(`${API_BASE_URL}/api/auth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        })
        .then(handleResponse)
        .then(data => {
            if (data.access_token) {
                accessToken = data.access_token;
                localStorage.setItem('procoreAccessToken', accessToken);
                updateTokenStatus();
                authCodeInput.value = '';
                // fetchAccidentLogs();
            }
        })
        .catch(handleError)
        .finally(() => setLoading(getTokenBtn, false));
    }

    function fetchAccidentLogs(fromDate = '', toDate = '') {
        if (!accessToken) {
            showError('Please authenticate first');
            return;
        }
        console.log("come form the applyDateFilter");
        
        setLoading(refreshLogsBtn, true);
        
        let url = `${API_BASE_URL}/api/accident-logs/filter`;
        console.log("url:",url);
        
        const params = new URLSearchParams();
        
        // Use the correct parameter names expected by the backend
        if (fromDate) params.append('filters[date][gte]', fromDate);
        if (toDate) params.append('filters[date][lte]', toDate);
        
        if (params.toString()) url += `?${params.toString()}`;
    
        fetch(url, {
            headers: { 
                'Authorization': `Bearer ${accessToken}`,
                'Procore-Company-Id': '4264807' // Add this if required
            }
        })
        .then(handleResponse)
        .then(displayAccidentLogs)
        .catch(handleError)
        .finally(() => setLoading(refreshLogsBtn, false));
    }

    // Apply date filter
    function applyDateFilter() {
        const fromDate = fromDateInput.value;
        const toDate = toDateInput.value;
        console.log("fromDate :",fromDate);
        console.log("toDate",toDate);
        
        
        if (!fromDate && !toDate) {
            showError('Please enter at least one date');
            return;
        }
        
        fetchAccidentLogs(fromDate, toDate);
    }

    // Clear date filter
    function clearDateFilter() {
        fromDateInput.value = '';
        toDateInput.value = '';
        fetchAccidentLogs();
    }

    // Display accident logs
    function displayAccidentLogs(logs) {
        logsList.innerHTML = logs.length ? '' : '<div class="no-logs">No logs found</div>';
        
        logs.forEach(log => {
            const logElement = document.createElement('div');
            logElement.className = 'log-item';
            logElement.innerHTML = `
                <div class="log-header">
                    <h3>Log #${log.id}</h3>
                    <button class="delete-btn" data-id="${log.id}">Delete</button>
                </div>
                <p><strong>Date:</strong> ${formatDate(log.date)}</p>
                <p><strong>Time:</strong> ${formatTime(log.time_hour, log.time_minute)}</p>
                <p><strong>Involved:</strong> ${log.involved_name} (${log.involved_company})</p>
                ${log.comments ? `<p><strong>Comments:</strong> ${log.comments}</p>` : ''}
            `;
            logsList.appendChild(logElement);
        });

        // Add delete event listeners
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (confirm('Delete this log?')) {
                    deleteAccidentLog(e.target.dataset.id);
                }
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