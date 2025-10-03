// ==== DOM Elements ====
const monthYear = document.getElementById("monthYear");
const daysContainer = document.getElementById("dates");
const prevButton = document.getElementById("prevMonth");
const nextButton = document.getElementById("nextMonth");
const monthViewBtn = document.getElementById('monthViewBtn');
const weekViewBtn = document.getElementById('weekViewBtn');
const weekViewContainer = document.getElementById('weekView');
const prevWeekBtn = document.getElementById('prevWeekBtn');
const nextWeekBtn = document.getElementById('nextWeekBtn');

const eventModal = document.getElementById('eventModal');
const eventTitleInput = document.getElementById('eventTitle');
const eventStartInput = document.getElementById('eventStart');
const eventEndInput = document.getElementById('eventEnd');
const saveEventBtn = document.getElementById('saveEventBtn');
const deleteEventBtn = document.getElementById('deleteEventBtn');
const cancelEventBtn = document.getElementById('cancelEventBtn');
const modalTitle = document.getElementById('modalTitle');

let weekStartDate = new Date(); // used when in week view
let editingContext = null; // { year, month, day, index } or { weekDayIndex, start, end }
// settings
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const format24Radio = document.getElementById('format24');
const format12Radio = document.getElementById('format12');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
// removed size slider controls — calendar size is fixed via CSS now

let timeFormat24 = true;
let manualSize = null; // null = auto

function loadSettings() {
    try {
        const raw = localStorage.getItem('calendarSettings');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        timeFormat24 = parsed.timeFormat24 ?? true;
    } catch (e) { console.warn(e); }
}
function saveSettings() {
    try { localStorage.setItem('calendarSettings', JSON.stringify({ timeFormat24 })); } catch (e) { }
}
loadSettings();
if (timeFormat24) format24Radio.checked = true; else format12Radio.checked = true;
// Do not force calendar width on load; week-mode will set a wider width when activated.

// settings button should not allow clicks to bubble into day cells
if (settingsBtn) settingsBtn.addEventListener('click', (e) => { e.stopPropagation(); if (eventModal) eventModal.style.display = 'none'; const wm = document.getElementById('weekEventModal'); if (wm) wm.style.display = 'none'; settingsModal.style.display = 'flex'; });
if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => { settingsModal.style.display = 'none'; });
saveSettingsBtn.addEventListener('click', () => {
    timeFormat24 = format24Radio.checked;
    saveSettings();
    settingsModal.style.display = 'none';
    renderCalendar(currentDate);
    if (weekViewContainer.style.display !== 'none') renderWeek(weekStartDate);
});

// slider logic
// size slider removed from UI

// ensure time format change updates week view times immediately
format24Radio.addEventListener('change', () => { timeFormat24 = true; renderCalendar(currentDate); if (weekViewContainer.style.display !== 'none') renderWeek(weekStartDate); });
format12Radio.addEventListener('change', () => { timeFormat24 = false; renderCalendar(currentDate); if (weekViewContainer.style.display !== 'none') renderWeek(weekStartDate); });

function formatTime(t) {
    // t is like '13:30' or an object {h,m}
    if (!t) return '';
    if (typeof t === 'string') {
        const [hh, mm] = t.split(':');
        let h = parseInt(hh,10), m = mm || '00';
        if (timeFormat24) return `${String(h).padStart(2,'0')}:${m}`;
        const suffix = h >= 12 ? 'PM' : 'AM';
        h = ((h + 11) % 12) + 1;
        return `${h}:${m} ${suffix}`;
    }
    return t;
}
// color pickers
const colorPicker = document.getElementById('colorPicker');
const applyColorBtn = document.getElementById('applyColorBtn');
const eventColorPicker = document.getElementById('eventColorPicker');
const applyEventColorBtn = document.getElementById('applyEventColorBtn');

// load persisted colors
if (localStorage.getItem('uiAccent')) {
    const c = localStorage.getItem('uiAccent');
    document.documentElement.style.setProperty('--accent', c);
    colorPicker.value = c;
}
if (localStorage.getItem('eventColor')) {
    const c = localStorage.getItem('eventColor');
    document.documentElement.style.setProperty('--event-color', c);
    eventColorPicker.value = c;
}

applyColorBtn.addEventListener('click', () => {
    const c = colorPicker.value;
    const fg = readableTextColor(c);
    document.documentElement.style.setProperty('--accent', c);
    document.documentElement.style.setProperty('--accent-foreground', fg);
    localStorage.setItem('uiAccent', c);
});
applyEventColorBtn.addEventListener('click', () => {
    const c = eventColorPicker.value;
    const fg = readableTextColor(c);
    document.documentElement.style.setProperty('--event-color', c);
    document.documentElement.style.setProperty('--event-foreground', fg);
    localStorage.setItem('eventColor', c);
    renderCalendar(currentDate);
    if (weekViewContainer.style.display !== 'none') renderWeek(weekStartDate);
});

// ...existing code... (openEventModal used for both month and week now)

// compute readable foreground (white or black depending on bg)
function readableTextColor(hex) {
    // hex like #rrggbb
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    // relative luminance
    const lum = (0.2126*r + 0.7152*g + 0.0722*b)/255;
    return lum > 0.7 ? '#111' : '#fff';
}

// auto-scaling: compute a width near the viewport width (94%)
// calendar width is controlled by CSS; week-mode will widen the calendar when activated

// Background mode persistence and application (top-level)
function applyBackgroundMode(mode, opts = {}) {
    localStorage.setItem('calendarBgMode', mode);
    if (mode === 'rainbow') {
        // clear any body backgrounds so the rainbow element is visible
        document.body.style.background = '';
        document.body.style.backgroundImage = '';
        document.body.style.backgroundColor = '';
        // also clear on the root element to avoid author styles overriding inline body bg
        document.documentElement.style.background = '';
        document.documentElement.style.backgroundImage = '';
        document.documentElement.style.backgroundColor = '';
        const rb = document.querySelector('.rainbow-bg');
        if (rb) rb.style.display = 'block';
    } else {
        const rb = document.querySelector('.rainbow-bg');
        if (rb) rb.style.display = 'none';
        if (mode === 'solid') {
            // set a solid background color on the body
            document.body.style.background = opts.color || '#ffffff';
            document.body.style.backgroundImage = '';
            document.body.style.backgroundColor = opts.color || '#ffffff';
            document.documentElement.style.background = opts.color || '#ffffff';
            document.documentElement.style.backgroundImage = '';
            document.documentElement.style.backgroundColor = opts.color || '#ffffff';
        } else if (mode === 'gradient') {
            const g1 = opts.color1 || '#ff8e9a';
            const g2 = opts.color2 || '#63bbff';
            const ratio = (opts.ratio != null) ? opts.ratio : parseInt(localStorage.getItem('bgRatio') || '50', 10);
            // ratio controls percentage of first color; convert to gradient stops
            const stop = Math.max(0, Math.min(100, ratio));
            document.body.style.background = `linear-gradient(135deg, ${g1} ${stop}%, ${g2} ${stop}%)`;
            document.body.style.backgroundImage = `linear-gradient(135deg, ${g1} ${stop}%, ${g2} ${stop}%)`;
            document.documentElement.style.background = `linear-gradient(135deg, ${g1} ${stop}%, ${g2} ${stop}%)`;
            document.documentElement.style.backgroundImage = `linear-gradient(135deg, ${g1} ${stop}%, ${g2} ${stop}%)`;
        }
    }
    // update UI text colors based on chosen background
    try { updateTextColorForBackground(); } catch (e) { }
}

// update text colors (calendar and events) based on current background mode/colors
function updateTextColorForBackground() {
    const mode = localStorage.getItem('calendarBgMode') || 'rainbow';
    if (mode === 'solid') {
        const bg = localStorage.getItem('bgSolid') || '#ffffff';
        const fg = readableTextColor(bg);
        document.documentElement.style.setProperty('--text-foreground', fg === '#fff' ? '#fff' : '#111');
        // choose event foreground opposite
        document.documentElement.style.setProperty('--event-foreground', fg === '#fff' ? '#fff' : '#111');
    } else if (mode === 'gradient') {
        const g1 = localStorage.getItem('bgGrad1') || '#ff8e9a';
        const g2 = localStorage.getItem('bgGrad2') || '#63bbff';
        // midpoint
        const mix = (hex => {
            const r = parseInt(hex.slice(1,3),16);
            const g = parseInt(hex.slice(3,5),16);
            const b = parseInt(hex.slice(5,7),16);
            return [r,g,b];
        });
        const a = mix(g1), b = mix(g2);
        const mid = `#${Math.floor((a[0]+b[0])/2).toString(16).padStart(2,'0')}${Math.floor((a[1]+b[1])/2).toString(16).padStart(2,'0')}${Math.floor((a[2]+b[2])/2).toString(16).padStart(2,'0')}`;
        const fg = readableTextColor(mid);
        document.documentElement.style.setProperty('--text-foreground', fg === '#fff' ? '#fff' : '#111');
        document.documentElement.style.setProperty('--event-foreground', fg === '#fff' ? '#fff' : '#111');
    } else {
        // rainbow: prefer dark text over the card and white for events
        document.documentElement.style.setProperty('--text-foreground', '#111');
        document.documentElement.style.setProperty('--event-foreground', '#fff');
    }
}

function loadBackgroundMode() {
    const mode = localStorage.getItem('calendarBgMode') || 'rainbow';
    const bgSolid = localStorage.getItem('bgSolid') || '#ffffff';
    const bg1 = localStorage.getItem('bgGrad1') || '#ff8e9a';
    const bg2 = localStorage.getItem('bgGrad2') || '#63bbff';
    // set UI radios if present
    if (document.getElementById('bgRainbow')) document.getElementById('bgRainbow').checked = (mode === 'rainbow');
    if (document.getElementById('bgSolid')) document.getElementById('bgSolid').checked = (mode === 'solid');
    if (document.getElementById('bgGradient')) document.getElementById('bgGradient').checked = (mode === 'gradient');
    const solidPicker = document.getElementById('bgSolidPicker');
    if (solidPicker) solidPicker.value = bgSolid;
    const g1 = document.getElementById('bgGrad1'); if (g1) g1.value = bg1;
    const g2 = document.getElementById('bgGrad2'); if (g2) g2.value = bg2;
    const ratioSlider = document.getElementById('bgRatio'); if (ratioSlider) ratioSlider.value = localStorage.getItem('bgRatio') || '50';
    applyBackgroundMode(mode, { color: bgSolid, color1: bg1, color2: bg2 });
    try { updateTextColorForBackground(); } catch (e) { }
}

// ==== Events storage ====
const events = {}; // ===== { year: { month: { day: [event1, event2] } } } =====

// Persist events to localStorage so they survive reloads
function saveEvents() {
    try {
        localStorage.setItem('calendarEvents', JSON.stringify(events));
    } catch (e) {
        console.warn('Could not save events to localStorage', e);
    }
}

function loadEvents() {
    try {
        const raw = localStorage.getItem('calendarEvents');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        // copy properties into the events object
        Object.assign(events, parsed);
    } catch (e) {
        console.warn('Could not load events from localStorage', e);
    }
}

function cleanupEmpty(year, month, day) {
    if (!events[year]) return;
    if (!events[year][month]) return;
    if (!events[year][month][day]) return;
    if (events[year][month][day].length === 0) {
        delete events[year][month][day];
        if (Object.keys(events[year][month]).length === 0) {
            delete events[year][month];
            if (Object.keys(events[year]).length === 0) {
                delete events[year];
            }
        }
    }
}

// load any previously saved events
loadEvents();

let currentDate = new Date();

// ==== Render calendar function ====
function renderCalendar(date) {
    const year = date.getFullYear();
    const month = date.getMonth();

    // ===== Set header =====
    monthYear.textContent = date.toLocaleString('default', { month: 'long', year: 'numeric' });

    // ===== Clear previous days =====
    daysContainer.innerHTML = "";

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // ===== Add blank cells for days before first of month =====
    for (let i = 0; i < firstDayOfMonth.getDay(); i++) {
        const blank = document.createElement("div");
        daysContainer.appendChild(blank);
    }

    // ===== Render actual days =====
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
        const dayDiv = document.createElement("div");
        dayDiv.classList.add("day-cell");
        dayDiv.innerHTML = `<span class="date-number">${day}</span>`;

        // ===== Highlight today =====
        const today = new Date();
        if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            dayDiv.classList.add("today");
        }

        // ===== Render events if any =====
        const dayEvents = (events[year]?.[month]?.[day]) || [];
        dayEvents.forEach((ev, idx) => {
            const evDiv = document.createElement("div");
            evDiv.className = "event";
            // if event is object show time + title, else show string
            if (typeof ev === 'object') {
                // month view: show only title
                evDiv.textContent = ev.title || '';
                // apply per-event color if provided, else use global
                const bg = ev.color || localStorage.getItem('eventColor') || getComputedStyle(document.documentElement).getPropertyValue('--event-color').trim();
                const fg = readableTextColor(bg);
                evDiv.style.background = bg;
                evDiv.style.color = fg === '#fff' ? '#fff' : '#111';
            } else {
                evDiv.textContent = ev;
            }

            // clicking an event opens the standard month edit modal
            evDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof ev !== 'object') return;
                if (settingsModal) settingsModal.style.display = 'none';
                openEventModal({ year, month, day, index: idx }, ev.start, ev.end);
            });

            dayDiv.appendChild(evDiv);
        });

        // ===== Click to add event (use modal so times can be set) =====
        dayDiv.addEventListener("click", () => {
            openEventModal({ year, month, day }, '09:00', '10:00');
        });

        daysContainer.appendChild(dayDiv);
    }
}

// ===== Week view rendering =====
function renderWeek(startDate) {
    weekViewContainer.innerHTML = '';
    const start = new Date(startDate);
    // normalize to sunday
    const dayOfWeek = start.getDay();
    start.setDate(start.getDate() - dayOfWeek);

    const grid = document.createElement('div');
    grid.className = 'week-grid';

    // first column: hour labels
    grid.appendChild(document.createElement('div')); // top-left empty

    for (let d = 0; d < 7; d++) {
        const header = document.createElement('div');
        header.textContent = new Date(start.getFullYear(), start.getMonth(), start.getDate() + d).toLocaleString('default', { weekday: 'short', month: 'short', day: 'numeric' });
        header.style.padding = '6px';
        grid.appendChild(header);
    }

    // hours 0-23
    for (let h = 0; h < 24; h++) {
        const hourLabel = document.createElement('div');
        hourLabel.className = 'hour-label';
        // use formatTime for display
        const display = timeFormat24 ? `${String(h).padStart(2,'0')}:00` : (() => {
            const suffix = h >= 12 ? 'PM' : 'AM';
            const hh = ((h + 11) % 12) + 1;
            return `${hh}:00 ${suffix}`;
        })();
        hourLabel.textContent = display;
        grid.appendChild(hourLabel);

        for (let d = 0; d < 7; d++) {
            const cell = document.createElement('div');
            cell.className = 'hour-cell day-column';
            // capture which day this is
            const cellDate = new Date(start.getFullYear(), start.getMonth(), start.getDate() + d);
            cell.dataset.year = cellDate.getFullYear();
            cell.dataset.month = cellDate.getMonth();
            cell.dataset.day = cellDate.getDate();
            cell.dataset.hour = h;

                // clicking creates event at this hour (opens modal prefilled)
                cell.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const y = cell.dataset.year, m = cell.dataset.month, day = cell.dataset.day;
                    openEventModal({ year: +y, month: +m, day: +day }, `${String(h).padStart(2,'0')}:00`, `${String(h+1).padStart(2,'0')}:00`);
                });

            grid.appendChild(cell);
        }
    }

    // populate events into week grid with overlapping layout
    for (let d = 0; d < 7; d++) {
        const cellDate = new Date(start.getFullYear(), start.getMonth(), start.getDate() + d);
        const y = cellDate.getFullYear(), m = cellDate.getMonth(), day = cellDate.getDate();
        const dayEvents = (events[y]?.[m]?.[day]) || [];

        // build events list with minutes
        const evList = dayEvents.map((ev, idx) => {
            if (typeof ev !== 'object' || !ev.start || !ev.end) return null;
            const [sh, sm] = ev.start.split(':').map(Number);
            const [eh, em] = ev.end.split(':').map(Number);
            const startMinutes = sh * 60 + sm;
            const endMinutes = eh * 60 + em;
            return { ev, idx, startMinutes, endMinutes };
        }).filter(Boolean);

        // sort by startMinutes asc, then by longer duration first
        evList.sort((a,b) => a.startMinutes - b.startMinutes || (b.endMinutes - b.startMinutes) - (a.endMinutes - a.startMinutes));

        // assign columns greedily
        const columns = [];
        const assignment = {}; // idx -> column
        evList.forEach(item => {
            let placed = false;
            for (let ci = 0; ci < columns.length; ci++) {
                // check last event end in column
                const last = columns[ci][columns[ci].length - 1];
                if (last.endMinutes <= item.startMinutes) {
                    columns[ci].push(item);
                    assignment[item.idx] = ci;
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                columns.push([item]);
                assignment[item.idx] = columns.length - 1;
            }
        });

        const cols = Math.max(1, columns.length);

        // render each event into its start cell, positioned and sized
        evList.forEach(item => {
            const { ev, idx, startMinutes, endMinutes } = item;
            const sh = Math.floor(startMinutes / 60);
            const sm = startMinutes % 60;
            const selector = `.hour-cell.day-column[data-year="${y}"][data-month="${m}"][data-day="${day}"][data-hour="${sh}"]`;
            const startCell = grid.querySelector(selector);
            if (!startCell) return;

            // compute hour cell height dynamically from rendered cell if possible
            const sampleCell = grid.querySelector('.hour-cell');
            const cellHeight = sampleCell ? sampleCell.getBoundingClientRect().height : 36;
            const topOffset = (sm / 60) * cellHeight + 2;
            const totalHeight = Math.max(18, ((endMinutes - startMinutes) / 60) * cellHeight - 4);

            const colIndex = assignment[idx];
            const leftPercent = (colIndex / cols) * 100;
            const widthPercent = (1 / cols) * 100;

            const evEl = document.createElement('div');
            evEl.className = 'week-event';
            if (totalHeight < 26) evEl.classList.add('short');
            evEl.style.top = `${topOffset}px`;
            evEl.style.height = `${totalHeight}px`;
            // use percentage positioning for side-by-side layout inside the cell
            evEl.style.left = `calc(${leftPercent}% + 4px)`;
            evEl.style.width = `calc(${widthPercent}% - 8px)`;
            evEl.textContent = `${formatTime(ev.start)} - ${formatTime(ev.end)} ${ev.title}`;
            // apply per-event color if available
            const bg = ev.color || localStorage.getItem('eventColor') || getComputedStyle(document.documentElement).getPropertyValue('--event-color').trim();
            const fg = readableTextColor(bg);
            evEl.style.background = bg;
            evEl.style.color = fg === '#fff' ? '#fff' : '#111';
            evEl.addEventListener('click', (e) => { e.stopPropagation(); if (settingsModal) settingsModal.style.display = 'none'; openEventModal({ year: y, month: m, day: day, index: idx }, ev.start, ev.end); });

            startCell.appendChild(evEl);
        });
    }

    weekViewContainer.appendChild(grid);

    // add current-hour indicator (use ResizeObserver + interval for robust updates)
    // remove existing line/observers/interval if present
    const existing = weekViewContainer.querySelector('.current-hour-line');
    if (existing) existing.remove();
    if (window._calendarCurrentHourInterval) { clearInterval(window._calendarCurrentHourInterval); window._calendarCurrentHourInterval = null; }
    if (window._calendarHourRO) { try { window._calendarHourRO.disconnect(); } catch (e) {} window._calendarHourRO = null; }
    if (window._calendarHourResizeListener) { try { window.removeEventListener('resize', window._calendarHourResizeListener); } catch (e) {} window._calendarHourResizeListener = null; }

    const now = new Date();
    const startOfWeek = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const dayIndex = Math.floor((now - startOfWeek) / (24 * 60 * 60 * 1000));
    if (dayIndex >= 0 && dayIndex < 7) {
        // find the first hour cell for this day (hour=0)
        const firstCell = grid.querySelector(`.hour-cell.day-column[data-year="${now.getFullYear()}"][data-month="${now.getMonth()}"][data-day="${now.getDate()}"][data-hour="0"]`);
        if (firstCell) {
            const line = document.createElement('div');
            line.className = 'current-hour-line';
            line.style.position = 'absolute';
            line.style.zIndex = '50';

            // helper to compute a good contrasting color and shadow
            const computeLineStyle = () => {
                const bgMode = localStorage.getItem('calendarBgMode') || 'rainbow';
                let colorIsLight = false;
                let baseColor = 'rgba(255,255,255,0.95)';
                if (bgMode === 'solid') {
                    const bg = (localStorage.getItem('bgSolid') || '#ffffff');
                    colorIsLight = (readableTextColor(bg) === '#fff');
                    baseColor = colorIsLight ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.85)';
                } else if (bgMode === 'gradient') {
                    const g1 = localStorage.getItem('bgGrad1') || '#ff8e9a';
                    const g2 = localStorage.getItem('bgGrad2') || '#63bbff';
                    const mix = (hex => {
                        const r = parseInt(hex.slice(1,3),16);
                        const g = parseInt(hex.slice(3,5),16);
                        const b = parseInt(hex.slice(5,7),16);
                        return [r,g,b];
                    });
                    const a = mix(g1), b = mix(g2);
                    const midColor = `#${Math.floor((a[0]+b[0])/2).toString(16).padStart(2,'0')}${Math.floor((a[1]+b[1])/2).toString(16).padStart(2,'0')}${Math.floor((a[2]+b[2])/2).toString(16).padStart(2,'0')}`;
                    colorIsLight = (readableTextColor(midColor) === '#fff');
                    baseColor = colorIsLight ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.85)';
                } else {
                    // rainbow: prefer white for visibility generally
                    colorIsLight = true;
                    baseColor = 'rgba(255,255,255,0.95)';
                }
                // choose a subtle shadow/outlining that contrasts with the base color
                const shadow = colorIsLight ? '0 0 6px rgba(0,0,0,0.6)' : '0 0 6px rgba(255,255,255,0.22)';
                return { baseColor, shadow };
            };

            const updateLine = () => {
                const now2 = new Date();
                const minutes2 = now2.getHours() * 60 + now2.getMinutes();
                // recompute hourHeight from rendered cell
                const sampleHour2 = grid.querySelector('.hour-cell');
                const hourHeight2 = sampleHour2 ? sampleHour2.getBoundingClientRect().height : 36;
                line.style.top = `${(minutes2 / 60) * hourHeight2}px`;

                // compute header bounding to limit the line to the day column
                const headerIndex = 1 + dayIndex; // grid children: 0 empty, 1..7 headers
                const headerEl = grid.children[headerIndex];
                if (headerEl) {
                    const gridRect2 = grid.getBoundingClientRect();
                    const hdrRect2 = headerEl.getBoundingClientRect();
                    const leftPx2 = hdrRect2.left - gridRect2.left;
                    line.style.left = `${leftPx2}px`;
                    line.style.width = `${hdrRect2.width}px`;
                } else {
                    line.style.left = '0';
                    line.style.right = '0';
                }

                const styleInfo = computeLineStyle();
                line.style.background = styleInfo.baseColor;
                line.style.boxShadow = styleInfo.shadow;
            };

            // initial update and insertion
            updateLine();
            grid.appendChild(line);

            // create a ResizeObserver to update position when layout changes
            try {
                window._calendarHourRO = new ResizeObserver(updateLine);
                window._calendarHourRO.observe(grid);
                // also observe the header cell for this day column
                const headerIndex = 1 + dayIndex;
                const headerEl2 = grid.children[headerIndex];
                if (headerEl2) window._calendarHourRO.observe(headerEl2);
            } catch (e) {
                // ResizeObserver not available in some environments - fall back to window resize
            }

            // also listen for window resize as a fallback
            window._calendarHourResizeListener = updateLine;
            window.addEventListener('resize', window._calendarHourResizeListener);

            // update every minute
            window._calendarCurrentHourInterval = setInterval(updateLine, 60 * 1000);
        }
    }
}

function openEventModal(dateObj, start = '09:00', end = '10:00', existingIndex = null) {
    // callers sometimes pass the event index inside dateObj (e.g. {year,month,day,index: idx})
    // so prefer the explicit existingIndex param when provided, otherwise fall back to dateObj.index
    const idx = (existingIndex != null) ? existingIndex : (dateObj && (dateObj.index != null) ? dateObj.index : null);
    editingContext = { ...dateObj, index: idx };
    modalTitle.textContent = idx != null ? 'Edit Event' : 'Add Event';
    eventTitleInput.value = '';
    eventStartInput.value = start;
    eventEndInput.value = end;
    if (idx != null) {
        const ev = events[dateObj.year]?.[dateObj.month]?.[dateObj.day]?.[idx];
        if (ev && typeof ev === 'object') {
            eventTitleInput.value = ev.title || '';
            eventStartInput.value = ev.start || start;
            eventEndInput.value = ev.end || end;
        }
        deleteEventBtn.style.display = '';
    } else {
        deleteEventBtn.style.display = 'none';
    }
    eventModal.style.display = 'flex';
}

function closeEventModal() {
    editingContext = null;
    eventModal.style.display = 'none';
}

saveEventBtn.addEventListener('click', () => {
    if (!editingContext) return;
    const title = eventTitleInput.value.trim();
    const start = eventStartInput.value;
    const end = eventEndInput.value;
    const { year, month, day, index } = editingContext;

    events[year] = events[year] || {};
    events[year][month] = events[year][month] || {};
    events[year][month][day] = events[year][month][day] || [];

    const evObj = { title, start, end };
    if (index != null) {
        events[year][month][day][index] = evObj;
    } else {
        events[year][month][day].push(evObj);
    }
    saveEvents();
    closeEventModal();
    renderCalendar(currentDate);
    if (weekViewContainer.style.display !== 'none') renderWeek(weekStartDate);
});

deleteEventBtn.addEventListener('click', () => {
    if (!editingContext) return;
    const { year, month, day, index } = editingContext;
    if (index == null) return;
    events[year][month][day].splice(index, 1);
    cleanupEmpty(year, month, day);
    saveEvents();
    closeEventModal();
    renderCalendar(currentDate);
    if (weekViewContainer.style.display !== 'none') renderWeek(weekStartDate);
});

cancelEventBtn.addEventListener('click', () => {
    closeEventModal();
});

// close week modal with escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const wm = document.getElementById('weekEventModal'); if (wm) wm.style.display = 'none';
        if (eventModal) eventModal.style.display = 'none';
        if (settingsModal) settingsModal.style.display = 'none';
    }
});

// toggle views
const calendarEl = document.querySelector('.calendar');

monthViewBtn.addEventListener('click', () => {
    calendarEl.classList.remove('week-mode');
    weekViewContainer.style.display = 'none';
    const wn = document.getElementById('weekNav'); if (wn) wn.style.display = 'none';
    document.getElementById('dates').style.display = '';
});
    // settings button in week-nav (appears under left week nav)
    const settingsWeekBtn = document.getElementById('settingsWeekBtn');
    if (settingsWeekBtn) settingsWeekBtn.addEventListener('click', (e) => { e.stopPropagation(); if (eventModal) eventModal.style.display = 'none'; const wm = document.getElementById('weekEventModal'); if (wm) wm.style.display = 'none'; if (settingsModal) settingsModal.style.display = 'flex'; });
weekViewBtn.addEventListener('click', () => {
    calendarEl.classList.add('week-mode');
    weekViewContainer.style.display = '';
    const wn = document.getElementById('weekNav'); if (wn) wn.style.display = 'flex';
    document.getElementById('dates').style.display = 'none';
    // set weekStartDate to the week containing currentDate
    weekStartDate = new Date(currentDate);
    // ensure week sizing (wider calendar) only happens when entering week mode
    document.documentElement.style.setProperty('--calendar-width', `900px`);
    renderWeek(weekStartDate);
});

// ==== Navigation buttons ====
prevButton.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar(currentDate);
    // keep week view in sync if visible
    weekStartDate = new Date(currentDate);
    if (weekViewContainer.style.display !== 'none') renderWeek(weekStartDate);
});

nextButton.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar(currentDate);
    // keep week view in sync if visible
    weekStartDate = new Date(currentDate);
    if (weekViewContainer.style.display !== 'none') renderWeek(weekStartDate);
});

// week navigation
prevWeekBtn.addEventListener('click', () => {
    weekStartDate.setDate(weekStartDate.getDate() - 7);
    renderWeek(weekStartDate);
    // keep month view in sync: set currentDate to the first day of the week
    currentDate = new Date(weekStartDate);
    renderCalendar(currentDate);
});
nextWeekBtn.addEventListener('click', () => {
    weekStartDate.setDate(weekStartDate.getDate() + 7);
    renderWeek(weekStartDate);
    currentDate = new Date(weekStartDate);
    renderCalendar(currentDate);
});

// Today button
const todayBtn = document.getElementById('todayBtn');
todayBtn.addEventListener('click', () => {
    const now = new Date();
    currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    renderCalendar(currentDate);
    weekStartDate = new Date(currentDate);
    if (weekViewContainer.style.display !== 'none') renderWeek(weekStartDate);
});

// simulate button press visual for all buttons on click (briefly add .pressed)
document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('button');
    if (!btn) return;
    btn.classList.add('pressed');
    setTimeout(() => btn.classList.remove('pressed'), 120);
});

// ==== Initial render ====
// ensure background selection from settings is applied
try { loadBackgroundMode(); } catch (e) { /* ignore if UI not present yet */ }

// Apply Background button handler (if present)
const applyBgBtn = document.getElementById('applyBgBtn');
if (applyBgBtn) {
    applyBgBtn.addEventListener('click', () => {
        const mode = document.querySelector('input[name="bgMode"]:checked')?.value || 'rainbow';
        const solid = document.getElementById('bgSolidPicker')?.value || '#ffffff';
        const g1 = document.getElementById('bgGrad1')?.value || '#ff8e9a';
        const g2 = document.getElementById('bgGrad2')?.value || '#63bbff';
        const ratio = parseInt(document.getElementById('bgRatio')?.value || '50', 10);
        localStorage.setItem('bgSolid', solid);
        localStorage.setItem('bgGrad1', g1);
        localStorage.setItem('bgGrad2', g2);
        localStorage.setItem('bgRatio', String(ratio));
        applyBackgroundMode(mode, { color: solid, color1: g1, color2: g2, ratio });
    });
}

renderCalendar(currentDate);

// Live preview: update background immediately when user changes radio or color inputs
function setupBackgroundLivePreview() {
    const radios = document.querySelectorAll('input[name="bgMode"]');
    const solidPicker = document.getElementById('bgSolidPicker');
    const g1 = document.getElementById('bgGrad1');
    const g2 = document.getElementById('bgGrad2');
    const ratio = document.getElementById('bgRatio');

    const applyPreview = () => {
        const mode = document.querySelector('input[name="bgMode"]:checked')?.value || 'rainbow';
        const solid = solidPicker?.value || '#ffffff';
        const cg1 = g1?.value || '#ff8e9a';
        const cg2 = g2?.value || '#63bbff';
        const r = parseInt(ratio?.value || '50', 10);
        applyBackgroundMode(mode, { color: solid, color1: cg1, color2: cg2, ratio: r });
    };

    radios.forEach(r => r.addEventListener('change', applyPreview));
    if (solidPicker) solidPicker.addEventListener('input', applyPreview);
    if (g1) g1.addEventListener('input', applyPreview);
    if (g2) g2.addEventListener('input', applyPreview);
    if (ratio) ratio.addEventListener('input', applyPreview);
}

try { setupBackgroundLivePreview(); } catch (e) { /* ignore if UI not present */ }
