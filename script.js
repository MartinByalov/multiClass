document.addEventListener('DOMContentLoaded', () => {
    // Елементи от DOM
    const gradebookBody = document.querySelector('#gradebook tbody');
    const classTabsDiv = document.getElementById('classTabs');
    const importSection = document.getElementById('import-section');
    
    // --- Добавен елемент за търсене ---
    const searchInput = document.getElementById('searchInput');

    // --- Създаване на скрития file input ---
    const xlsxFileInput = document.createElement('input');
    xlsxFileInput.type = 'file';
    xlsxFileInput.id = 'xlsxFileInput';
    xlsxFileInput.accept = '.xlsx, .xls';
    xlsxFileInput.style.display = 'none'; // Скриване на елемента
    if (importSection) {
        importSection.prepend(xlsxFileInput); 
    }
    
    // Бутони и полета 
    const importFileBtn = document.getElementById('importFileBtn');
    const exportAllBtn = document.getElementById('exportAllBtn');

    // --- КЛЮЧОВА СТРУКТУРА: ДАННИ ЗА ВСИЧКИ КЛАСОВЕ ---
    let classData = JSON.parse(localStorage.getItem('classData')) || {}; 
    let classNames = Object.keys(classData);
    let currentClass = localStorage.getItem('currentClass') || classNames[0];
    
    if (!classData[currentClass]) {
        currentClass = classNames[0] || null;
    }
    
    // --- ПОМОЩНИ ФУНКЦИИ ---
    function saveAllData() {
        localStorage.setItem('classData', JSON.stringify(classData));
        if (currentClass) {
            localStorage.setItem('currentClass', currentClass);
        } else {
            localStorage.removeItem('currentClass');
        }
    }

    function findNextId(className) {
        const students = classData[className];
        return students.length > 0 ? Math.max(...students.map(s => s.id)) + 1 : 1;
    }

    /**
     * Форматира историята (actions). Връща чист низ, за да може CSS да контролира wrap-а.
     */
    function formatHistory(text) {
        return text;
    }

    /**
     * Добавя/Обновява данни на ученици към даден клас. 
     */
    function updateClassData(className, studentRecords) {
        if (!classData[className]) {
            classData[className] = [];
        }
        let students = classData[className];
        
        const existingStudentsMap = new Map(students.map(s => [s.name.toLowerCase(), s]));

        let nextId = findNextId(className);

        const newStudentsList = studentRecords.map(record => {
            const name = record.name.trim();
            const existing = existingStudentsMap.get(name.toLowerCase());

            if (existing) {
                existing.actions = record.actions || '';
                existing.status = record.status || '';
                existing.sequence = 0; 
                existing.type = null;
                return existing;
            } else {
                return {
                    id: nextId++,
                    name: name,
                    actions: record.actions || '',
                    status: record.status || '',
                    sequence: 0,
                    type: null
                };
            }
        });

        classData[className] = newStudentsList;
        return newStudentsList.length;
    }


    // --- ФУНКЦИИ ЗА УПРАВЛЕНИЕ НА КЛАСОВЕ (ТАБОВЕ) ---
    
    function renderTabs() {
        classTabsDiv.innerHTML = '';
        const classNames = Object.keys(classData);

        if (classNames.length > 0 && !currentClass) {
            currentClass = classNames[0];
        }
        
        const titleElement = document.querySelector('main h2');
        if (titleElement) {
             titleElement.textContent = `Клас: ${currentClass || 'Няма избран клас'}`;
        }


        classNames.forEach(className => {
            const button = document.createElement('button');
            button.className = `tab-button ${className === currentClass ? 'active' : ''}`;
            button.textContent = className;
            button.onclick = () => switchClass(className);
            classTabsDiv.appendChild(button);
        });
    }

    function switchClass(className) {
        if (currentClass === className) return;
        currentClass = className;
        // Изчистване на търсачката при смяна на клас
        if (searchInput) {
            searchInput.value = '';
        }
        renderTabs();
        renderStudents();
        saveAllData();
    }
    
    // --- ФУНКЦИИ ЗА УПРАВЛЕНИЕ НА УЧЕНИЦИ ---

    /**
     * Премахва маркирането от всички имена в таблицата.
     */
    function removeHighlights() {
        const nameCells = gradebookBody.querySelectorAll('td:nth-child(2)');
        nameCells.forEach(cell => {
            cell.innerHTML = cell.textContent; // Заместваме HTML със самия текст
        });
    }

    function renderStudents() {
        gradebookBody.innerHTML = '';
        if (!currentClass || !classData[currentClass]) return;

        const students = classData[currentClass];

        students.forEach(student => {
            const row = gradebookBody.insertRow();
            
            const isOfficialPraise = student.status && student.status.includes('➕');
            const isOfficialNote = student.status && student.status.includes('➖');

            row.id = `student-${student.id}`;
            row.className = isOfficialPraise ? 'official-praise' :
                             isOfficialNote ? 'official-note' : '';
            // Добавяне на data атрибути за търсене
            row.setAttribute('data-id', student.id);
            row.setAttribute('data-name', student.name.toLowerCase());

            row.insertCell().textContent = student.id;             // 1: №
            row.insertCell().textContent = student.name;           // 2: Име на ученик (текстът ще бъде заместен от filterTable)
            
            // 3: ВЪВЕЖДАНЕ 
            const inputCell = row.insertCell();
            inputCell.innerHTML = `
                <button class="action-btn" onclick="addSymbol(${student.id}, '🇴')">🇴</button>
                <button class="action-btn" onclick="addSymbol(${student.id}, '❌')">❌</button>
            `;
            
            // 4: ДЕЙСТВИЯ 
            const historyCell = row.insertCell();
            historyCell.className = 'action-history';
            // Обвиваме всеки символ в историята в <span> за унифициран стил
            historyCell.innerHTML = Array.from(formatHistory(student.actions)).map(s => 
                `<span class="action-symbol">${s}</span>`
            ).join('');
            
            // 5: ПОВЕДЕНИЕ
            const statusCell = row.insertCell();
            statusCell.id = `status-${student.id}`;
            // Обвиваме всеки символ в статуса в <span> за унифициран стил
            statusCell.innerHTML = Array.from(student.status).map(s => 
                `<span class="action-symbol ${s === '➕' ? 'status-ok' : 'status-warning'}">${s}</span>`
            ).join('');
        });
        saveAllData();
        // При рендериране, прилагаме филтъра и маркирането
        if (searchInput && searchInput.value) {
            filterTable(searchInput.value);
        }
    }

    // Логика за Анулиране и Добавяне
    window.addSymbol = (studentId, symbol) => {
        const students = classData[currentClass];
        const student = students.find(s => s.id === studentId);
        if (!student) return;

        const newType = symbol === '🇴' ? 'praise' : 'note';
        let isCancellation = student.type && newType !== student.type;

        // 1. АНУЛИРАНЕ
        if (isCancellation) {
            
            if (student.actions.length > 0) {
                let symbols = Array.from(student.actions);
                symbols.pop(); 
                student.actions = symbols.join(''); 
            }
            
            student.sequence = 0; 
            student.type = null;
            
        } 
        
        // 2. ДОБАВЯНЕ
        else {
            
            if (student.type === null && student.actions.length > 0) {
                student.actions = '';
            }

            student.sequence++;
            student.type = newType;
            student.actions += symbol; 
        }

        // 3. Проверка за Официален Запис (3 последователни)
        if (student.sequence >= 3) {
            
            const statusSymbol = newType === 'praise' ? '➕' : '➖';
            
            student.status += statusSymbol; 
            student.actions = '';          
            student.sequence = 0;          
            student.type = null;
        } 
        
        renderStudents(); 
    }
    
    // --- ФУНКЦИЯ ЗА ТЪРСЕНЕ (С МАРКИРАНЕ) ---
    function filterTable(searchTerm) {
        const filter = searchTerm.toLowerCase().trim();
        const rows = gradebookBody.querySelectorAll('tr');

        // Премахваме старото маркиране от предишните търсения
        removeHighlights();

        rows.forEach(row => {
            const name = row.getAttribute('data-name');
            const id = row.getAttribute('data-id');
            const nameCell = row.cells[1]; // Клетка с името на ученика

            if (filter === '') {
                // Ако търсенето е празно
                row.style.display = ''; 
            } else if (name && name.includes(filter)) {
                // Съвпадение по име (прилагаме highlight)
                row.style.display = '';

                // Логика за маркиране на търсения текст в клетката
                const originalName = nameCell.textContent;
                const startIndex = name.indexOf(filter);
                const endIndex = startIndex + filter.length;

                if (startIndex !== -1) {
                    const before = originalName.substring(0, startIndex);
                    const highlightText = originalName.substring(startIndex, endIndex);
                    const after = originalName.substring(endIndex);

                    nameCell.innerHTML = `${before}<span class="highlight">${highlightText}</span>${after}`;
                }

            } else if (id && id === filter) {
                // Съвпадение по ID (само показваме реда)
                row.style.display = '';
            } 
            else {
                // Няма съвпадение
                row.style.display = 'none';
            }
        });
    }


    // --- ЛОГИКА ЗА ИМПОРТ И ЕКСПОРТ ---
    
    // Добавяне на събитие към търсачката
    if (searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            filterTable(e.target.value);
        });
        
        // Добавяне на 'input' събитие, за да работи по-добре при изтриване
        searchInput.addEventListener('input', (e) => {
            filterTable(e.target.value);
        });
    }

    // При клик върху бутона "Импорт", активираме скрития file input
    if (importFileBtn) {
        importFileBtn.addEventListener('click', () => {
            xlsxFileInput.click(); 
        });
    }

    // При промяна на файла (т.е. когато потребителят избере файл), започваме импорта
    xlsxFileInput.addEventListener('change', () => {
        if (!xlsxFileInput.files.length) {
            return;
        }
        
        const file = xlsxFileInput.files[0];
        const reader = new FileReader();

        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            let totalRecordsImported = 0;
            let lastSheetName = null;

            workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                const records = sheetData
                    .slice(1) 
                    .map(row => {
                        const name = (row[1] || '').toString().trim();
                        const actions = (row[2] || '').toString().trim(); 
                        const status = (row[4] || '').toString().trim();
                        
                        const normalizedStatus = status.replace(/\+/g, '➕').replace(/\-/g, '➖');
                        
                        if (name.length > 0) {
                            return { name, actions, status: normalizedStatus };
                        }
                        return null;
                    })
                    .filter(record => record !== null);
                
                totalRecordsImported += updateClassData(sheetName.trim(), records);
                lastSheetName = sheetName.trim();
            });
            
            if (!currentClass && lastSheetName) {
                currentClass = lastSheetName;
            }

            renderTabs(); 
            renderStudents(); 
            xlsxFileInput.value = ''; 
            alert(`Успешно импортирани ${totalRecordsImported} записа. Добавени/Обновени класове: ${workbook.SheetNames.join(', ')}.`);
        };

        reader.readAsArrayBuffer(file);
    });

    // 2. ЕКСПОРТ НА ВСИЧКИ класове към Excel (XLSX)
    exportAllBtn.addEventListener('click', () => {
        const classNames = Object.keys(classData);
        if (classNames.length === 0) {
            alert("Няма данни за експорт.");
            return;
        }

        const workbook = XLSX.utils.book_new();

        classNames.forEach(className => {
            const students = classData[className];
            if (students.length === 0) return;

            const sheetData = [
                ["№", "Име на ученик", "Действия", "Символ", "Поведение"] // Заглавен ред
            ];

            students.forEach(student => {
                const exportedActions = student.actions; 
                
                // При експорт връщаме символите към + и - за Excel
                const exportedStatus = student.status.replace(/➕/g, '+').replace(/➖/g, '-');
                
                sheetData.push([
                    student.id, 
                    student.name, 
                    exportedActions,
                    '', 
                    exportedStatus
                ]);
            });

            const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
            XLSX.utils.book_append_sheet(workbook, worksheet, className);
        });
        
        XLSX.writeFile(workbook, 'Class_Gradebook_Report.xlsx');
    });

    // Инициализация
    renderTabs();
    renderStudents();
});