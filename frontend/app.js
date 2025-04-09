document.addEventListener('DOMContentLoaded', function() {
    const API_BASE_URL = 'http://localhost:8080';
    let accessToken = localStorage.getItem('procoreAccessToken') || '';
    let currentFilters = {};
    


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
    const severityFilter = document.getElementById('severityFilter');
    const companyFilter = document.getElementById('companyFilter');
    const filterLogsBtn = document.getElementById('filterLogsBtn');
    const clearFilterBtn = document.getElementById('clearFilterBtn');
    const editModal = document.getElementById('editModal');
    const closeEditModal = document.getElementById('closeEditModal');
    const editLogForm = document.getElementById('editLogForm');

    // Set default date values to current month
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    fromDateInput.valueAsDate = firstDayOfMonth;
    toDateInput.valueAsDate = today;
    severity="";
    // Update token status display
    function updateTokenStatus() {
        tokenStatus.textContent = accessToken ? '✔ Token available' : '✖ No token';
        tokenStatus.className = accessToken ? 'token-status token-valid' : 'token-status token-invalid';
    }

    // Initialize
    updateTokenStatus();

    // Event listeners
    getAuthBtn.addEventListener('click', getAuthorizationCode);
    getTokenBtn.addEventListener('click', getAccessToken);
    refreshLogsBtn.addEventListener('click', () => fetchAccidentLogs(currentFilters));
    filterLogsBtn.addEventListener('click', applyDateFilter);
    clearFilterBtn.addEventListener('click', clearDateFilter);
    createLogForm.addEventListener('submit', handleCreateLog);
    closeEditModal.addEventListener('click', () => editModal.classList.remove('active'));
    editLogForm.addEventListener('submit', handleUpdateLog);

    // Close modal when clicking outside
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) {
            editModal.classList.remove('active');
        }
    });

    // Get authorization code
    function getAuthorizationCode() {
        const clientId = '_DKvGlwYKsqe9QxBhZ00eZ9RmmOKd8dzyovUKxVL510'; // Default client ID
        const authUrl = `https://login-sandbox.procore.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=urn:ietf:wg:oauth:2.0:oob`;
        window.open(authUrl, '_blank');
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
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.error || 'Failed to get access token');
                });
            }
            return response.json();
        })
        .then(data => {
            accessToken = data.access_token;
            localStorage.setItem('procoreAccessToken', accessToken);
            updateTokenStatus();
            showSuccess('Access token obtained successfully');
            //fetchAccidentLogs();
        })
        .catch(error => {
            handleError(error);
        })
        .finally(() => {
            setLoading(getTokenBtn, false);
        });
    }

    // Fetch accident logs
    function fetchAccidentLogs(filters = {}) {
        if (!accessToken) {
            showError('Please authenticate first');
            return;
        }

        setLoading(refreshLogsBtn, true);
        
        let url = `${API_BASE_URL}/api/accident-logs`;
        if (Object.keys(filters).length > 0) {
            const params = new URLSearchParams();
            if (filters.fromDate) params.append('from_date', filters.fromDate);
            if (filters.toDate) params.append('to_date', filters.toDate);
            if (filters.severity) params.append('severity', filters.severity);
            if (filters.company) params.append('company', filters.company);
            url = `${API_BASE_URL}/api/accident-logs/filter?${params.toString()}`;
        }

        fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.error || 'Failed to fetch logs');
                });
            }
            return response.json();
        })
        .then(logs => {
            renderLogsList(logs);
        })
        .catch(error => {
            handleError(error);
        })
        .finally(() => {
            setLoading(refreshLogsBtn, false);
        });
    }

    // Render logs list
    function renderLogsList(logs) {
        if (!logs || logs.length === 0) {
            logsList.innerHTML = '<div class="no-logs">No logs found</div>';
            return;
        }

        logsList.innerHTML = logs.map(log => `
           
            <div class="log-item" data-id="${log.id}">
                <div class="log-header">
                    <h3>${log.involved_name} (${log.involved_company})</h3>
                    <span class="severity-${log.severity ?? 'unknown'}">${(log.severity ?? 'unknown').toUpperCase()}</span>
                </div>
                <div class="log-details">
                    <div>
                        <strong>Date:</strong>
                        <span>${log.date}</span>
                    </div>
                    <div>
                        <strong>Time:</strong>
                        <span>${formatTime(log.time_hour, log.time_minute)}</span>
                    </div>
                    <div>
                        <strong>Location:</strong>
                        <span>${log.location || 'N/A'}</span>
                    </div>
                </div>
                <div class="log-actions">
                    <button class="edit-btn" data-id="${log.id}">Edit</button>
                    <button class="delete-btn danger-btn" data-id="${log.id}">Delete</button>
                </div>
                ${log.comments ? `<div class="log-comments"><strong>Comments:</strong> ${log.comments}</div>` : ''}
            </div>
        `).join('');

        // Add event listeners to edit and delete buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(btn.dataset.id));
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => handleDeleteLog(btn.dataset.id));
        });
    }

    // Open edit modal with log data
    function openEditModal(logId) {
        if (!accessToken) {
            showError('Please authenticate first');
            return;
        }

        fetch(`${API_BASE_URL}/api/accident-logs/${logId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.error || 'Failed to fetch log details');
                });
            }
            return response.json();
        })
        .then(log => {
            document.getElementById('editLogId').value = log.id;
            document.getElementById('editDate').value = log.date;
            document.getElementById('editTimeHour').value = log.time_hour;
            document.getElementById('editTimeMinute').value = log.time_minute;
            document.getElementById('editInvolvedName').value = log.involved_name;
            document.getElementById('editInvolvedCompany').value = log.involved_company;
            document.getElementById('editSeverity').value = log.severity;
            document.getElementById('editLocation').value = log.location || '';
            document.getElementById('editComments').value = log.comments || '';
            
            editModal.classList.add('active');
        })
        .catch(error => {
            handleError(error);
        });
    }

    // Handle create log form submission
    function handleCreateLog(e) {
        e.preventDefault();
        
        if (!accessToken) {
            showError('Please authenticate first');
            return;
        }

        const formData = {
            date: document.getElementById('date').value,
            time_hour: parseInt(document.getElementById('timeHour').value),
            time_minute: parseInt(document.getElementById('timeMinute').value),
            involved_name: document.getElementById('involvedName').value,
            involved_company: document.getElementById('involvedCompany').value,
            severity: document.getElementById('severity').value,
            location: document.getElementById('location').value,
            comments: document.getElementById('comments').value,
            datetime: `${document.getElementById('date').value} ${formatTime(
                parseInt(document.getElementById('timeHour').value),
                parseInt(document.getElementById('timeMinute').value)
            )}`
        };

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
                return response.json().then(errorData => {
                    throw new Error(errorData.error || 'Failed to create log');
                });
            }
            return response.json();
        })
        .then(() => {
            showSuccess('Log created successfully');
            createLogForm.reset();
            fetchAccidentLogs(currentFilters);
        })
        .catch(error => {
            handleError(error);
        });
    }

    // Handle update log form submission
    function handleUpdateLog(e) {
        e.preventDefault();
        
        if (!accessToken) {
            showError('Please authenticate first');
            return;
        }

        const logId = document.getElementById('editLogId').value;
        const formData = {
            date: document.getElementById('editDate').value,
            time_hour: parseInt(document.getElementById('editTimeHour').value),
            time_minute: parseInt(document.getElementById('editTimeMinute').value),
            involved_name: document.getElementById('editInvolvedName').value,
            involved_company: document.getElementById('editInvolvedCompany').value,
            severity: document.getElementById('editSeverity').value,
            location: document.getElementById('editLocation').value,
            comments: document.getElementById('editComments').value,
            datetime: `${document.getElementById('editDate').value} ${formatTime(
                parseInt(document.getElementById('editTimeHour').value),
                parseInt(document.getElementById('editTimeMinute').value)
            )}`
        };

        fetch(`${API_BASE_URL}/api/accident-logs/${logId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.error || 'Failed to update log');
                });
            }
            return response.json();
        })
        .then(() => {
            showSuccess('Log updated successfully');
            editModal.classList.remove('active');
            fetchAccidentLogs(currentFilters);
        })
        .catch(error => {
            handleError(error);
        });
    }

    // Handle delete log
    function handleDeleteLog(logId) {
        if (!accessToken) {
            showError('Please authenticate first');
            return;
        }

        if (!confirm('Are you sure you want to delete this log?')) {
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
                return response.json().then(errorData => {
                    throw new Error(errorData.error || 'Failed to delete log');
                });
            }
            return response.json();
        })
        .then(() => {
            showSuccess('Log deleted successfully');
            fetchAccidentLogs(currentFilters);
        })
        .catch(error => {
            handleError(error);
        });
    }

    // Apply date filter
    function applyDateFilter() {
        currentFilters = {
            fromDate: fromDateInput.value,
            toDate: toDateInput.value,
            severity: severityFilter.value,
            company: companyFilter.value.trim()
        };
        fetchAccidentLogs(currentFilters);
    }

    // Clear date filter
    function clearDateFilter() {
        fromDateInput.valueAsDate = firstDayOfMonth;
        toDateInput.valueAsDate = today;
        severityFilter.value = '';
        companyFilter.value = '';
        currentFilters = {};
        fetchAccidentLogs();
    }

    // Handles errors from fetch calls
    function handleError(error) {
        console.error('API Error:', error);
        const message = error.message || 'An unexpected error occurred';
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

    // Show error message
    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    // Show success message
    function showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }

    // Initial fetch of logs if token exists
    if (accessToken) {
        fetchAccidentLogs();
    }
});