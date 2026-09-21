// app.js
let currentTasks = [];
let selectedDate = '';
let tasksToCopy = []; 

document.addEventListener('DOMContentLoaded', () => {
    const datePicker = document.getElementById('date-picker');
    const now = new Date();
    
    // Set today's date
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    selectedDate = `${year}-${month}-${day}`;
    datePicker.value = selectedDate;

    const legacy = localStorage.getItem('timeTrackerTasks');
    if (legacy) {
        localStorage.setItem(`timeTrackerTasks_${selectedDate}`, legacy);
        localStorage.removeItem('timeTrackerTasks');
    }

    // 초기 데이터 로드
    loadTasks();
    
    // 로컬 스토리지에 데이터가 비어있다면 자동으로 data.json 연동 시도
    if (currentTasks.length === 0) {
        autoLoadFromJson();
    }

    datePicker.addEventListener('change', (e) => {
        selectedDate = e.target.value;
        loadTasks();
        // 날짜를 바꿨는데 해당 날짜의 데이터가 없으면 자동 연동 시도
        if (currentTasks.length === 0) {
            autoLoadFromJson();
        }
    });

    document.getElementById('import-btn').addEventListener('click', importFromExcel);
    document.getElementById('load-json-btn').addEventListener('click', loadFromJson);
    document.getElementById('export-btn').addEventListener('click', exportToExcel);
    
    document.getElementById('download-json-btn').addEventListener('click', () => {
        const allData = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('timeTrackerTasks_')) {
                const dateStr = key.replace('timeTrackerTasks_', '');
                try {
                    const tasks = JSON.parse(localStorage.getItem(key));
                    if (tasks && tasks.length > 0) {
                        allData[dateStr] = tasks;
                    }
                } catch(e) {}
            }
        }
        
        if (Object.keys(allData).length === 0) {
            alert('다운로드할 데이터가 없습니다.');
            return;
        }

        const dataStr = JSON.stringify(allData, null, 4);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    document.getElementById('reset-btn').addEventListener('click', () => {
        if(confirm(`${selectedDate}의 모든 데이터를 초기화하시겠습니까?`)) {
            currentTasks = [];
            saveTasks();
            renderTasks();
            document.getElementById('excel-input').value = '';
        }
    });

    // 일괄 처리 버튼 이벤트 리스너
    document.getElementById('select-all-cb').addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        currentTasks.forEach(t => {
            if(t.content !== '내용' || t.note !== '비고') {
                t.selected = isChecked;
            }
        });
        saveTasks();
        renderTasks();
    });

    document.getElementById('batch-copy-btn').addEventListener('click', () => {
        const selected = currentTasks.filter(t => t.selected);
        if (selected.length === 0) {
            alert('복사할 항목을 체크박스로 선택해주세요.');
            return;
        }
        tasksToCopy = selected; 
        showCopyModal();
    });

    document.getElementById('batch-delete-btn').addEventListener('click', () => {
        const selected = currentTasks.filter(t => t.selected);
        if (selected.length === 0) {
            alert('삭제할 항목을 체크박스로 선택해주세요.');
            return;
        }
        if (confirm(`선택한 ${selected.length}개의 항목을 정말 삭제하시겠습니까?`)) {
            currentTasks = currentTasks.filter(t => !t.selected);
            saveTasks();
            renderTasks();
        }
    });

    // 모달 이벤트 리스너
    document.getElementById('cancel-copy-btn').addEventListener('click', () => {
        document.getElementById('copy-modal').style.display = 'none';
    });

    document.getElementById('add-custom-date-btn').addEventListener('click', () => {
        const customDate = document.getElementById('custom-copy-date').value;
        if (customDate) {
            const checkboxes = document.getElementById('date-checkboxes');
            checkboxes.innerHTML += `
                <label class="date-checkbox-label">
                    <input type="checkbox" value="${customDate}" class="copy-date-cb" checked> ${customDate}
                </label>
            `;
            document.getElementById('custom-copy-date').value = '';
        }
    });

    document.getElementById('confirm-copy-btn').addEventListener('click', () => {
        const cbs = document.querySelectorAll('.copy-date-cb:checked');
        if (cbs.length === 0) {
            alert('복사할 날짜를 선택해주세요.');
            return;
        }
        
        cbs.forEach(cb => {
            const targetDate = cb.value;
            const targetKey = `timeTrackerTasks_${targetDate}`;
            let targetTasks = [];
            const saved = localStorage.getItem(targetKey);
            if (saved) {
                targetTasks = JSON.parse(saved);
            }
            
            tasksToCopy.forEach(task => {
                const newTask = {...task};
                newTask.startTime = '';
                newTask.endTime = '';
                newTask.duration = '';
                newTask.completed = false;
                newTask.selected = false; 
                
                targetTasks.push(newTask);
            });
            
            targetTasks.sort((a, b) => a.rowNumber - b.rowNumber);
            localStorage.setItem(targetKey, JSON.stringify(targetTasks));
        });
        
        alert('선택한 날짜로 복사되었습니다.');
        
        currentTasks.forEach(t => t.selected = false);
        saveTasks();
        renderTasks();
        
        document.getElementById('copy-modal').style.display = 'none';
    });
});

function loadTasks() {
    const saved = localStorage.getItem(`timeTrackerTasks_${selectedDate}`);
    if (saved) {
        currentTasks = JSON.parse(saved);
        
        let needsSave = false;
        currentTasks = currentTasks.filter(t => t.content || t.note || t.startTime || t.endTime);
        currentTasks.forEach((t, i) => {
            if (!t.rowNumber) {
                t.rowNumber = i + 1;
                needsSave = true;
            }
            if (t.selected === undefined) {
                t.selected = false;
            }
        });
        if (needsSave) saveTasks();
        
    } else {
        currentTasks = [];
    }
    
    currentTasks.sort((a, b) => a.rowNumber - b.rowNumber);
    renderTasks();
}

function saveTasks() {
    localStorage.setItem(`timeTrackerTasks_${selectedDate}`, JSON.stringify(currentTasks));
    autoSaveToServer();
}

async function autoSaveToServer() {
    const allData = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('timeTrackerTasks_')) {
            const dateStr = key.replace('timeTrackerTasks_', '');
            try {
                const tasks = JSON.parse(localStorage.getItem(key));
                if (tasks && tasks.length > 0) {
                    allData[dateStr] = tasks;
                }
            } catch(e) {}
        }
    }
    
    try {
        await fetch('http://localhost:8000/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(allData, null, 4)
        });
    } catch(e) {
        // 서버가 꺼져있을 때는 에러를 무시합니다.
    }
}

// 자동 연동 로직 (앱 시작 시 또는 새 날짜 선택 시)
async function autoLoadFromJson() {
    try {
        // GitHub Pages의 강력한 캐시 방지를 위해 타임스탬프 추가
        const res = await fetch('data.json?t=' + new Date().getTime());
        if (!res.ok) return;
        const data = await res.json();
        
        let loadedTasks = [];
        if (!Array.isArray(data)) {
            // data.json이 객체 형태인 경우 (특정 날짜 지정) {"2026-09-21": [...], "2026-09-22": [...]}
            if (data[selectedDate]) {
                loadedTasks = data[selectedDate];
            } else {
                return;
            }
        } else {
            // 기존처럼 배열 형태일 경우 (모든 빈 날짜의 템플릿으로 사용)
            loadedTasks = data;
        }

        currentTasks = loadedTasks;
        
        currentTasks.forEach((t, i) => {
            if (!t.rowNumber) t.rowNumber = i + 1;
            t.selected = false;
        });

        saveTasks();
        renderTasks();
    } catch (e) {
        console.error('Auto-load JSON failed:', e);
    }
}

// 수동 연동 로직 (버튼 클릭 시 강제 덮어쓰기)
async function loadFromJson() {
    try {
        const res = await fetch('data.json?t=' + new Date().getTime());
        if (!res.ok) throw new Error('네트워크 응답이 정상이 아닙니다.');
        const data = await res.json();
        
        let loadedTasks = [];
        if (!Array.isArray(data)) {
            if (data[selectedDate]) {
                loadedTasks = data[selectedDate];
            } else {
                alert(`data.json에 [${selectedDate}] 날짜의 데이터가 없습니다.`);
                return;
            }
        } else {
            loadedTasks = data;
        }

        currentTasks = loadedTasks;
        
        currentTasks.forEach((t, i) => {
            if (!t.rowNumber) t.rowNumber = i + 1;
            t.selected = false;
        });

        saveTasks();
        renderTasks();
        alert(`data.json에서 ${selectedDate} 목록을 성공적으로 불러왔습니다!`);
    } catch (e) {
        console.error(e);
        alert('data.json 파일을 불러오지 못했습니다. 파일이 존재하는지 확인해주세요.');
    }
}

// 소요시간 제외 체크박스 상태 저장 및 복원
document.addEventListener('DOMContentLoaded', () => {
    const cb = document.getElementById('exclude-duration-cb');
    if (cb) {
        cb.checked = localStorage.getItem('excludeDuration') === 'true';
        cb.addEventListener('change', (e) => {
            localStorage.setItem('excludeDuration', e.target.checked);
        });
    }
});

window.updateTime = function(index, field, value) {
    currentTasks[index][field] = value;
    
    if (currentTasks[index].startTime && currentTasks[index].endTime) {
        currentTasks[index].duration = calculateDuration(currentTasks[index].startTime, currentTasks[index].endTime);
        currentTasks[index].completed = true;
    } else {
        currentTasks[index].duration = '';
        currentTasks[index].completed = false;
    }
    
    saveTasks();
    renderTasks();
};

function importFromExcel() {
    const text = document.getElementById('excel-input').value;
    if (!text) {
        alert('엑셀 데이터를 입력칸에 붙여넣어주세요.');
        return;
    }

    const lines = text.split('\n');
    currentTasks = [];
    
    lines.forEach((line, i) => {
        const cols = line.split('\t'); 
        if (!cols[0]?.trim() && !cols[1]?.trim() && !cols[2]?.trim()) return;

        let isCompleted = false;
        if (cols[5]) {
            const val = cols[5].trim().toUpperCase();
            if (val === 'O' || val === '0') isCompleted = true;
        }

        currentTasks.push({
            rowNumber: i + 1,
            content: cols[0]?.trim() || '',
            note: cols[1]?.trim() || '',
            startTime: cols[2]?.trim() || '',
            endTime: cols[3]?.trim() || '',
            duration: cols[4]?.trim() || '',
            completed: isCompleted,
            selected: false
        });
    });
    
    saveTasks();
    renderTasks();
    document.getElementById('excel-input').value = '';
    alert(`${selectedDate} 목록을 성공적으로 가져왔습니다!`);
}

function escapeHtml(str) {
    if(!str) return '';
    return String(str).replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/"/g, "&quot;")
                      .replace(/'/g, "&#039;");
}

function renderTasks() {
    const listEl = document.getElementById('task-list');
    const emptyMsg = document.getElementById('empty-message');
    listEl.innerHTML = '';

    if (currentTasks.length > 0) {
        emptyMsg.style.display = 'none';
    } else {
        emptyMsg.style.display = 'block';
    }

    currentTasks.forEach((task, index) => {
        if (task.content === '내용' && task.note === '비고') return; 

        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        
        li.innerHTML = `
            <div class="item-row">
                <div class="task-text">
                    <div class="row-number-wrapper">
                        <input type="checkbox" class="task-select-cb" ${task.selected ? 'checked' : ''} onchange="toggleTaskSelect(${index}, this.checked)" title="항목 선택">
                        <span>엑셀 행:</span>
                        <input type="number" class="edit-row" value="${task.rowNumber}" onchange="updateTask(${index}, 'rowNumber', this.value)" title="엑셀 복사 시 위치할 행 번호">
                    </div>
                    <input type="text" class="edit-title" value="${escapeHtml(task.content)}" onchange="updateTask(${index}, 'content', this.value)" placeholder="제목 입력">
                    <input type="text" class="edit-note" value="${escapeHtml(task.note)}" onchange="updateTask(${index}, 'note', this.value)" placeholder="비고 입력">
                </div>
                <div class="task-mini-actions">
                    <button class="btn-icon" onclick="openCopyModal(${index})" title="이 항목만 다른 날짜로 복사">🗓️ 날짜복사</button>
                    <button class="btn-icon" onclick="resetTime(${index})" title="시간 초기화">🔄</button>
                    <button class="btn-icon" onclick="copyItem(${index})" title="항목 복제(현재 날짜)">📋</button>
                    <button class="btn-icon" onclick="deleteItem(${index})" title="항목 삭제">❌</button>
                </div>
            </div>
            <div class="item-row">
                <div class="task-times-inline">
                    <div style="align-items: flex-start;">시작 <input type="time" class="edit-time" value="${task.startTime}" onchange="updateTime(${index}, 'startTime', this.value)" title="시작 시간 직접 수정"></div>
                    <div style="align-items: flex-start;">끝 <input type="time" class="edit-time" value="${task.endTime}" onchange="updateTime(${index}, 'endTime', this.value)" title="마침 시간 직접 수정"></div>
                    <div>소요 <span class="duration-text">${task.duration || '-'}</span></div>
                </div>
                <div class="task-main-actions">
                    <button class="btn-start" onclick="recordTime(${index}, 'start')">시작</button>
                    <button class="btn-end" onclick="recordTime(${index}, 'end')">마침</button>
                </div>
            </div>
        `;
        listEl.appendChild(li);
    });
    
    updateSelectAllCheckbox();
}

window.toggleTaskSelect = function(index, isChecked) {
    currentTasks[index].selected = isChecked;
    saveTasks();
    updateSelectAllCheckbox();
};

function updateSelectAllCheckbox() {
    const selectAllCb = document.getElementById('select-all-cb');
    const selectable = currentTasks.filter(t => !(t.content === '내용' && t.note === '비고'));
    if (selectable.length === 0) {
        selectAllCb.checked = false;
        return;
    }
    selectAllCb.checked = selectable.every(t => t.selected);
}

window.updateTask = function(index, field, value) {
    if (field === 'rowNumber') {
        currentTasks[index][field] = parseInt(value, 10) || 1;
        currentTasks.sort((a, b) => a.rowNumber - b.rowNumber);
    } else {
        currentTasks[index][field] = value;
    }
    saveTasks();
    if(field === 'rowNumber') renderTasks(); 
};

window.openCopyModal = function(index) {
    tasksToCopy = [currentTasks[index]];
    showCopyModal();
};

function showCopyModal() {
    const modal = document.getElementById('copy-modal');
    const checkboxes = document.getElementById('date-checkboxes');
    checkboxes.innerHTML = '';
    
    for(let i = 1; i <= 5; i++) {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${day}`;
        
        checkboxes.innerHTML += `
            <label class="date-checkbox-label">
                <input type="checkbox" value="${dateStr}" class="copy-date-cb"> ${dateStr}
            </label>
        `;
    }
    modal.style.display = 'flex';
}

window.recordTime = function(index, type) {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeString = `${hours}:${minutes}`;

    if (type === 'start') {
        currentTasks[index].startTime = timeString;
        currentTasks[index].completed = false;
        currentTasks[index].endTime = '';
        currentTasks[index].duration = '';
    } else if (type === 'end') {
        currentTasks[index].endTime = timeString;
        
        if (currentTasks[index].startTime) {
            currentTasks[index].duration = calculateDuration(currentTasks[index].startTime, timeString);
            currentTasks[index].completed = true;
        } else {
            alert("시작 시간을 먼저 기록해주세요.");
            return;
        }
    }
    
    saveTasks();
    renderTasks();
};

window.resetTime = function(index) {
    if(confirm('이 항목의 기록된 시간을 초기화하시겠습니까?')) {
        currentTasks[index].startTime = '';
        currentTasks[index].endTime = '';
        currentTasks[index].duration = '';
        currentTasks[index].completed = false;
        saveTasks();
        renderTasks();
    }
};

window.copyItem = function(index) {
    const task = currentTasks[index];
    const newTask = {...task};
    
    newTask.rowNumber = task.rowNumber + 1;
    
    currentTasks.forEach(t => {
        if(t.rowNumber > task.rowNumber) t.rowNumber++;
    });

    currentTasks.push(newTask);
    currentTasks.sort((a, b) => a.rowNumber - b.rowNumber);
    saveTasks();
    renderTasks();
};

window.deleteItem = function(index) {
    if(confirm('이 항목을 삭제하시겠습니까?')) {
        currentTasks.splice(index, 1);
        saveTasks();
        renderTasks();
    }
};

function calculateDuration(start, end) {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    
    const startTotal = startH * 60 + startM;
    let endTotal = endH * 60 + endM;
    
    if (endTotal < startTotal) {
        endTotal += 24 * 60; 
    }
    
    const diff = endTotal - startTotal;
    const diffH = String(Math.floor(diff / 60)).padStart(2, '0');
    const diffM = String(diff % 60).padStart(2, '0');
    
    return `${diffH}:${diffM}`;
}

function exportToExcel() {
    if (currentTasks.length === 0) {
        alert('내보낼 데이터가 없습니다.');
        return;
    }

    const cb = document.getElementById('exclude-duration-cb');
    const excludeDuration = cb && cb.checked;

    const maxRow = Math.max(...currentTasks.map(t => t.rowNumber));
    let textLines = new Array(maxRow).fill('\t\t\t\t\t'); 

    currentTasks.forEach(task => {
        const completedMark = task.completed ? '0' : ''; 
        const dur = excludeDuration ? '' : (task.duration || '');
        textLines[task.rowNumber - 1] = `${task.content}\t${task.note}\t${task.startTime}\t${task.endTime}\t${dur}\t${completedMark}`;
    });

    const text = textLines.join('\n');

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            alert(`${selectedDate} 결과가 클립보드에 복사되었습니다! 엑셀에 붙여넣기(Ctrl+V) 하세요.`);
        }).catch(err => {
            fallbackCopyTextToClipboard(text);
        });
    } else {
        fallbackCopyTextToClipboard(text);
    }
}

function fallbackCopyTextToClipboard(text) {
    const textarea = document.getElementById('excel-input');
    textarea.value = text;
    textarea.select();
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            alert(`${selectedDate} 결과가 복사되었습니다! 입력칸의 텍스트가 복사되었으니 엑셀에 붙여넣기 하세요.`);
        } else {
            alert('클립보드 복사에 실패했습니다. 위 입력칸의 텍스트를 직접 복사하세요.');
        }
    } catch (err) {
        alert('클립보드 복사에 실패했습니다. 위 입력칸의 텍스트를 직접 복사하세요.');
    }
    textarea.value = ''; 
}
