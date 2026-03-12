/**
 * Number System Game Logic
 * Handles 16-bit signed/unsigned number conversions, game state, and explanations.
 */

// Constants for 16-bit (2 Bytes)
const MAX_VAL = 0xFFFF; // 65535
const SIGN_BIT_MASK = 0x8000;
const STATE_SIZE = 3;

const Conversions = {
    generateRandomVal: () => {
        return Math.floor(Math.random() * (MAX_VAL + 1));
    },

    toSigned: (val) => {
        if (val & SIGN_BIT_MASK) {
            return val - (MAX_VAL + 1);
        }
        return val;
    },

    toBin: (val) => val.toString(2).padStart(16, '0'),
    toOct: (val) => val.toString(8).padStart(6, '0'),
    toDec: (val) => val.toString(10),
    toHex: (val) => val.toString(16).toUpperCase().padStart(4, '0'),
};

const Explainer = {
    getSteps: (q, targetType) => {
        // Find best source (visible field)
        const sourceBase = ['dec', 'hex', 'bin', 'oct'].find(k => q.solvedState[k] && k !== targetType) || q.sourceBase;
        const rawTicket = q.values.ticket;
        const sourceVal = q.values[sourceBase].toUpperCase();

        let steps = [];
        steps.push(`<strong>Goal:</strong> Convert ${sourceBase.toUpperCase()} <code>${sourceVal}</code> to ${targetType.toUpperCase()}.`);

        // Context
        if (q.isSigned) {
            steps.push(`<strong>Context:</strong> This is a 16-bit <strong>Signed</strong> number.`);
        } else {
            steps.push(`<strong>Context:</strong> This is a 16-bit <strong>Unsigned</strong> number.`);
        }

        // Logic branching
        // If Signed and value is negative (MSB set), explain 2's complement logic first if Dec is involved
        const isNegative = (rawTicket & SIGN_BIT_MASK) !== 0;

        if (targetType === 'dec') {
            if (q.isSigned && isNegative) {
                steps.push(`<div class="step">1. <strong>Check Sign Bit:</strong> The 16th bit is 1, so it's negative.</div>`);
                steps.push(`<div class="step">2. <strong>Invert Bits:</strong> <code>${Conversions.toBin(rawTicket)}</code> becomes <code>${Conversions.toBin(~rawTicket & MAX_VAL)}</code>.</div>`);
                steps.push(`<div class="step">3. <strong>Add 1:</strong> Result is <code>${(~rawTicket & MAX_VAL) + 1}</code>.</div>`);
                steps.push(`<div class="step">4. <strong>Apply Sign:</strong> The magnitude is ${((~rawTicket & MAX_VAL) + 1)}, so the answer is <code>-${((~rawTicket & MAX_VAL) + 1)}</code>.</div>`);
            } else {
                // Standard conversion
                if (sourceBase === 'hex') {
                    steps.push(`<div class="step">1. <strong>Position Powers:</strong> Multiply each digit by 16^n.<br>
                    Ex: <code>${sourceVal}</code> = ${parseInt(sourceVal, 16)}.</div>`);
                } else if (sourceBase === 'bin') {
                    steps.push(`<div class="step">1. <strong>Sum Weights:</strong> Add powers of 2 where bit is 1.</div>`);
                } else {
                    steps.push(`<div class="step">1. <strong>Convert:</strong> Just convert base ${sourceBase} directly to Decimal: ${q.values.dec}.</div>`);
                }
            }
        }
        else if (sourceBase === 'dec') {
            // Dec -> Others
            if (q.isSigned && parseInt(q.values.dec) < 0) {
                steps.push(`<div class="step">1. <strong>Handle Negative:</strong> Number is ${q.values.dec}.</div>`);
                steps.push(`<div class="step">2. <strong>Positive Binary:</strong> ${Math.abs(q.values.dec)} in binary is <code>${(Math.abs(q.values.dec)).toString(2).padStart(16, '0')}</code>.</div>`);
                steps.push(`<div class="step">3. <strong>2's Complement:</strong> Invert bits and add 1 to get <code>${q.values.bin}</code>.</div>`);
            } else {
                steps.push(`<div class="step">1. <strong>Division Method:</strong> Repeatedly divide ${q.values.dec} by the target base (${targetType === 'hex' ? 16 : targetType === 'oct' ? 8 : 2}) and keep remainders.</div>`);
            }
            if (targetType === 'hex') steps.push(`<div class="step">Result: <code>${q.values.hex}</code></div>`);
            if (targetType === 'oct') steps.push(`<div class="step">Result: <code>${q.values.oct}</code></div>`);
            if (targetType === 'bin') steps.push(`<div class="step">Result: <code>${q.values.bin}</code></div>`);
        }
        else {
            // Hex <-> Bin <-> Oct (Direct mappings)
            if (targetType === 'bin' && sourceBase === 'hex') {
                steps.push(`<div class="step">1. <strong>Expand Hex:</strong> Each Hex digit = 4 Binary bits.<br>
                <code>${sourceVal.split('').join(' ')}</code><br>
                <code>${sourceVal.split('').map(h => parseInt(h, 16).toString(2).padStart(4, '0')).join(' ')}</code></div>`);
            } else if (targetType === 'hex' && sourceBase === 'bin') {
                steps.push(`<div class="step">1. <strong>Group Bits:</strong> Group binary into chunks of 4 from right to left.<br>
                 Convert each chunk to Hex.</div>`);
            } else {
                steps.push(`<div class="step">1. <strong>Intermediate:</strong> Easiest to convert ${sourceBase} -> Binary -> ${targetType}.</div>`);
            }
        }

        return steps.join('');
    }
};

class Game {
    constructor() {
        this.questions = [];
        this.totalAttempts = 0;
        this.correctAttempts = 0;

        this.container = document.getElementById('game-board');
        this.scoreObj = {
            ratio: document.getElementById('score-ratio'),
            percentage: document.getElementById('score-percentage')
        };
        this.historyLog = document.getElementById('history-log');

        // Modal logic
        this.modalOverlay = document.getElementById('modal-overlay');
        this.modalContent = document.getElementById('modal-content');
        document.getElementById('close-modal').addEventListener('click', () => this.hideModal());

        for (let i = 0; i < STATE_SIZE; i++) {
            this.addQuestion();
        }
    }

    addQuestion() {
        const q = this.generateQuestionData();
        this.questions.push(q);
        this.renderCard(q);
    }

    generateQuestionData() {
        const isSigned = Math.random() > 0.5;
        const rawValue = Conversions.generateRandomVal();
        const bases = ['bin', 'oct', 'dec', 'hex'];

        const numGiven = Math.floor(Math.random() * 3) + 1;
        const shuffled = bases.sort(() => 0.5 - Math.random());
        const givenBases = shuffled.slice(0, numGiven);
        const sourceBase = givenBases[0];

        let outputValues = {};
        if (isSigned) {
            outputValues = {
                bin: Conversions.toBin(rawValue),
                oct: Conversions.toOct(rawValue),
                dec: Conversions.toSigned(rawValue).toString(10),
                hex: Conversions.toHex(rawValue),
                ticket: rawValue
            };
        } else {
            outputValues = {
                bin: Conversions.toBin(rawValue),
                oct: Conversions.toOct(rawValue),
                dec: rawValue.toString(10),
                hex: Conversions.toHex(rawValue),
                ticket: rawValue
            };
        }

        let solvedState = { bin: false, oct: false, dec: false, hex: false };
        givenBases.forEach(b => solvedState[b] = true);

        return {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            isSigned,
            sourceBase,
            values: outputValues,
            solvedState
        };
    }

    validateInput(id, type, value) {
        const q = this.questions.find(item => item.id === id);
        if (!q) return;
        if (value.trim() === '') return;

        let isValid = false;
        const cleanVal = value.trim().toLowerCase();

        this.totalAttempts++;

        try {
            if (type === 'bin') {
                const binStr = cleanVal.replace(/[^01]/g, '');
                if (binStr && parseInt(binStr, 2) === q.values.ticket) isValid = true;
            } else if (type === 'oct') {
                if (parseInt(cleanVal, 8) === q.values.ticket) isValid = true;
            } else if (type === 'hex') {
                const hexStr = cleanVal.startsWith('0x') ? cleanVal.slice(2) : cleanVal;
                if (parseInt(hexStr, 16) === q.values.ticket) isValid = true;
            } else if (type === 'dec') {
                if (parseInt(cleanVal, 10) === parseInt(q.values.dec, 10)) isValid = true;
            }
        } catch (e) { isValid = false; }

        if (isValid) {
            this.correctAttempts++;
            this.logHistory(q, type, value, true);
            this.updateScore();
            this.markCorrect(q, type);
        } else {
            this.logHistory(q, type, value, false);
            this.updateScore();
            const inputEl = document.querySelector(`.card[data-id="${id}"] input[data-type="${type}"]`);
            if (inputEl) {
                inputEl.parentElement.classList.add('wrong');
                setTimeout(() => inputEl.parentElement.classList.remove('wrong'), 500);
            }
        }
    }

    updateScore() {
        if (this.totalAttempts === 0) {
            this.scoreObj.percentage.innerText = '0%';
            this.scoreObj.ratio.innerText = '0/0';
            return;
        }
        const percentage = Math.round((this.correctAttempts / this.totalAttempts) * 100);
        this.scoreObj.percentage.innerText = `${percentage}%`;
        this.scoreObj.ratio.innerText = `${this.correctAttempts}/${this.totalAttempts}`;

        if (percentage >= 80) this.scoreObj.percentage.style.color = 'var(--success-color)';
        else if (percentage < 50) this.scoreObj.percentage.style.color = 'var(--error-color)';
        else this.scoreObj.percentage.style.color = 'var(--accent-color)';
    }

    logHistory(q, type, inputVal, isCorrect) {
        let lhsBase = 'hex';
        const possibleSources = ['hex', 'dec', 'oct', 'bin'].filter(k => q.solvedState[k] && k !== type);
        const sourceBase = possibleSources.length > 0 ? possibleSources[0] : 'hex';
        const sourceVal = q.values[sourceBase].toUpperCase();

        const msg = isCorrect
            ? `${sourceVal}<sub>${sourceBase}</sub> = ${q.values[type]}<sub>${type}</sub>`
            : `${sourceVal}<sub>${sourceBase}</sub> != ${inputVal}<sub>${type}</sub>`;

        const div = document.createElement('div');
        div.className = `log-item ${isCorrect ? 'success' : 'error'}`;
        div.innerHTML = msg;

        const placeholder = this.historyLog.querySelector('.history-placeholder');
        if (placeholder) placeholder.remove();
        this.historyLog.prepend(div);
    }

    markCorrect(q, type) {
        if (q.solvedState[type]) return;
        q.solvedState[type] = true;

        const inputEl = document.querySelector(`.card[data-id="${q.id}"] input[data-type="${type}"]`);
        if (inputEl) {
            inputEl.parentElement.classList.add('correct');
            inputEl.parentElement.classList.remove('wrong');
            inputEl.disabled = true;
            // Remove show button if present
            const btn = inputEl.parentElement.parentElement.querySelector('.show-btn');
            if (btn) btn.remove();
        }

        if (['bin', 'oct', 'dec', 'hex'].every(k => q.solvedState[k])) {
            this.replaceCard(q.id);
        }
    }

    replaceCard(id) {
        const card = document.querySelector(`.card[data-id="${id}"]`);
        if (card) {
            card.classList.add('solved-anim');
            setTimeout(() => {
                card.remove();
                this.questions = this.questions.filter(item => item.id !== id);
                this.addQuestion();
            }, 500);
        }
    }

    createInputHtml(q, type, fullWidth = false) {
        const isSolved = q.solvedState[type];
        const val = isSolved ? q.values[type] : '';
        const disabled = isSolved ? 'disabled' : '';
        const correctClass = isSolved ? 'correct' : '';
        const method = `game.validateInput('${q.id}', '${type}', this.value)`;

        const labels = { bin: 'Binary', oct: 'Octal', dec: 'Decimal', hex: 'Hexadecimal' };

        let showBtn = '';
        if (!isSolved) {
            showBtn = `<button class="show-btn" onclick="game.showExpl('${q.id}', '${type}')">Show</button>`;
        }

        return `
            <div class="input-group ${fullWidth ? 'full-width' : ''}">
                <label>
                    ${labels[type]}
                    ${showBtn}
                </label>
                <div class="input-wrapper ${correctClass}">
                    <input type="text" 
                        data-type="${type}" 
                        value="${val}" 
                        ${disabled} 
                        placeholder="?"
                        onchange="${method}"
                        onkeyup="if(event.key === 'Enter') ${method}"
                    >
                </div>
            </div>
        `;
    }

    renderCard(q) {
        const card = document.createElement('div');
        card.className = 'card';
        card.setAttribute('data-id', q.id);

        const badgeClass = q.isSigned ? 'signed' : 'unsigned';
        const badgeText = q.isSigned ? 'Signed (16-bit)' : 'Unsigned (16-bit)';

        const binHtml = this.createInputHtml(q, 'bin', true);
        const othersHtml = ['dec', 'oct', 'hex'].map(type => this.createInputHtml(q, type)).join('');

        card.innerHTML = `
            <div class="card-header">
                <span class="card-title">Problem ${q.id.substr(-4).toUpperCase()}</span>
                <span class="badge ${badgeClass}">${badgeText}</span>
            </div>
            <div class="inputs-row-full">
                ${binHtml}
            </div>
            <div class="inputs-grid-3">
                ${othersHtml}
            </div>
        `;

        this.container.appendChild(card);
    }

    showExpl(qId, type) {
        const q = this.questions.find(item => item.id === qId);
        if (!q) return;
        const html = Explainer.getSteps(q, type);
        this.modalContent.innerHTML = html;
        this.modalOverlay.classList.remove('hidden');
    }

    hideModal() {
        this.modalOverlay.classList.add('hidden');
    }
}

window.onload = () => {
    window.game = new Game();
};
