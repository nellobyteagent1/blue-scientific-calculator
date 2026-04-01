(() => {
  const state = {
    expression: '0',
    history: '',
    result: '0',
    angleMode: 'DEG',
    justCalculated: false,
  };

  const expressionEl = document.getElementById('expression');
  const resultEl = document.getElementById('result');
  const historyEl = document.getElementById('history');
  const angleLabelEl = document.getElementById('angle-mode-label');
  const angleButtons = Array.from(document.querySelectorAll('[data-angle-mode]'));
  const buttonGrid = document.getElementById('button-grid');

  const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'log', 'ln', 'sqrt']);
  const CONSTANTS = { pi: Math.PI, e: Math.E };
  const PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };
  const RIGHT_ASSOC = new Set(['^']);

  function updateUI() {
    expressionEl.textContent = formatExpression(state.expression);
    historyEl.textContent = state.history;
    resultEl.textContent = state.result;
    resultEl.classList.toggle('is-error', state.result === 'Error');
    angleLabelEl.textContent = state.angleMode;

    angleButtons.forEach((btn) => {
      const active = btn.dataset.angleMode === state.angleMode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  function flashResult() {
    resultEl.classList.remove('flash');
    void resultEl.offsetWidth;
    resultEl.classList.add('flash');
  }

  function resetIfNeeded(nextToken) {
    if (!state.justCalculated) return;
    if (/^[0-9.(]$/.test(nextToken) || FUNCTIONS.has(nextToken) || nextToken === 'pi' || nextToken === 'e') {
      state.expression = '0';
      state.history = '';
    } else {
      state.expression = String(state.result === 'Error' ? '0' : state.result);
    }
    state.justCalculated = false;
  }

  function appendValue(value) {
    resetIfNeeded(value);

    if (state.expression === '0' && value !== '.' && value !== ')') {
      if (value === '(' || FUNCTIONS.has(value) || value === 'pi' || value === 'e') {
        state.expression = value === '(' ? '(' : `${value}(`.replace('((', '(');
        if (value === 'pi' || value === 'e') state.expression = value;
      } else {
        state.expression = value;
      }
    } else {
      if (FUNCTIONS.has(value)) {
        if (needsImplicitMultiply(state.expression.slice(-1))) state.expression += '*';
        state.expression += `${value}(`;
      } else if (value === 'pi' || value === 'e') {
        if (needsImplicitMultiply(state.expression.slice(-1))) state.expression += '*';
        state.expression += value;
      } else if (value === '(') {
        if (needsImplicitMultiply(state.expression.slice(-1))) state.expression += '*';
        state.expression += value;
      } else {
        state.expression += value;
      }
    }

    preview();
    updateUI();
  }

  function needsImplicitMultiply(lastChar) {
    return /[0-9)e.%]/.test(lastChar || '');
  }

  function appendOperator(operator) {
    resetIfNeeded(operator);
    if (state.expression === '0' && operator !== '-') return;
    if (/[+\-*/^]$/.test(state.expression)) {
      state.expression = state.expression.slice(0, -1) + operator;
    } else {
      state.expression += operator;
    }
    state.justCalculated = false;
    preview();
    updateUI();
  }

  function clearAll() {
    state.expression = '0';
    state.history = '';
    state.result = '0';
    state.justCalculated = false;
    updateUI();
  }

  function deleteLast() {
    if (state.justCalculated) {
      clearAll();
      return;
    }
    state.expression = state.expression.length <= 1 ? '0' : state.expression.slice(0, -1);
    preview();
    updateUI();
  }

  function negateCurrent() {
    resetIfNeeded('(');
    const tokens = tokenize(state.expression);
    if (!tokens.length) return;
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
      if (tokens[i].type === 'number') {
        tokens[i].value = String(-Number(tokens[i].value));
        state.expression = tokensToExpression(tokens);
        preview();
        updateUI();
        return;
      }
    }
  }

  function percentCurrent() {
    resetIfNeeded('%');
    state.expression += '%';
    preview();
    updateUI();
  }

  function calculate() {
    try {
      const value = evaluateExpression(state.expression, state.angleMode);
      state.history = `${formatExpression(state.expression)} =`;
      state.result = formatNumber(value);
      state.expression = state.result;
      state.justCalculated = true;
      flashResult();
    } catch {
      state.result = 'Error';
      state.justCalculated = true;
    }
    updateUI();
  }

  function preview() {
    try {
      const value = evaluateExpression(state.expression, state.angleMode);
      state.result = formatNumber(value);
    } catch {
      state.result = state.expression === '0' ? '0' : state.result;
    }
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) throw new Error('Invalid number');
    const normalized = Math.abs(value) >= 1e12 || (Math.abs(value) > 0 && Math.abs(value) < 1e-9)
      ? value.toExponential(8)
      : Number(value.toPrecision(12)).toString();
    return normalized;
  }

  function formatExpression(expression) {
    return expression
      .replace(/\*/g, '×')
      .replace(/\//g, '÷')
      .replace(/pi/g, 'π');
  }

  function tokenize(input) {
    const tokens = [];
    let i = 0;
    while (i < input.length) {
      const char = input[i];
      if (/\s/.test(char)) { i += 1; continue; }

      if (/[0-9.]/.test(char)) {
        let number = char;
        i += 1;
        while (i < input.length && /[0-9.]/.test(input[i])) {
          number += input[i];
          i += 1;
        }
        if ((number.match(/\./g) || []).length > 1) throw new Error('Bad number');
        tokens.push({ type: 'number', value: number });
        continue;
      }

      if (/[a-z]/i.test(char)) {
        let word = char;
        i += 1;
        while (i < input.length && /[a-z]/i.test(input[i])) {
          word += input[i];
          i += 1;
        }
        if (FUNCTIONS.has(word)) {
          tokens.push({ type: 'function', value: word });
        } else if (Object.hasOwn(CONSTANTS, word)) {
          tokens.push({ type: 'number', value: String(CONSTANTS[word]) });
        } else {
          throw new Error('Unknown token');
        }
        continue;
      }

      if ('+-*/^()%'.includes(char)) {
        tokens.push({ type: char === '(' || char === ')' ? 'paren' : 'operator', value: char });
        i += 1;
        continue;
      }

      throw new Error('Unexpected character');
    }
    return normalizeTokens(tokens);
  }

  function normalizeTokens(tokens) {
    const normalized = [];
    tokens.forEach((token, index) => {
      const prev = normalized[normalized.length - 1];
      const next = tokens[index + 1];

      if (token.value === '-' && (!prev || (prev.type === 'operator' && prev.value !== '%') || (prev.type === 'paren' && prev.value === '('))) {
        normalized.push({ type: 'function', value: 'neg' });
        return;
      }

      if (prev && shouldMultiply(prev, token)) {
        normalized.push({ type: 'operator', value: '*' });
      }

      normalized.push(token);

      if (token.type === 'function' && token.value !== 'neg' && (!next || next.value !== '(')) {
        throw new Error('Function requires parentheses');
      }
    });
    return normalized;
  }

  function shouldMultiply(prev, next) {
    const prevValueLike = prev.type === 'number' || (prev.type === 'paren' && prev.value === ')') || (prev.type === 'operator' && prev.value === '%');
    const nextValueLike = next.type === 'number' || next.type === 'function' || (next.type === 'paren' && next.value === '(');
    return prevValueLike && nextValueLike;
  }

  function toRpn(tokens) {
    const output = [];
    const ops = [];

    tokens.forEach((token) => {
      if (token.type === 'number') {
        output.push(token);
      } else if (token.type === 'function') {
        ops.push(token);
      } else if (token.type === 'operator') {
        if (token.value === '%') {
          output.push(token);
          return;
        }
        while (ops.length) {
          const top = ops[ops.length - 1];
          if (
            (top.type === 'function') ||
            (top.type === 'operator' && top.value !== '(' && (
              PRECEDENCE[top.value] > PRECEDENCE[token.value] ||
              (PRECEDENCE[top.value] === PRECEDENCE[token.value] && !RIGHT_ASSOC.has(token.value))
            ))
          ) {
            output.push(ops.pop());
          } else {
            break;
          }
        }
        ops.push(token);
      } else if (token.type === 'paren' && token.value === '(') {
        ops.push(token);
      } else if (token.type === 'paren' && token.value === ')') {
        while (ops.length && ops[ops.length - 1].value !== '(') {
          output.push(ops.pop());
        }
        if (!ops.length) throw new Error('Mismatched parentheses');
        ops.pop();
        if (ops.length && ops[ops.length - 1].type === 'function') {
          output.push(ops.pop());
        }
      }
    });

    while (ops.length) {
      const token = ops.pop();
      if (token.value === '(' || token.value === ')') throw new Error('Mismatched parentheses');
      output.push(token);
    }
    return output;
  }

  function evaluateRpn(rpn, angleMode) {
    const stack = [];
    rpn.forEach((token) => {
      if (token.type === 'number') {
        stack.push(Number(token.value));
        return;
      }

      if (token.type === 'operator') {
        if (token.value === '%') {
          const value = stack.pop();
          stack.push(value / 100);
          return;
        }
        const right = stack.pop();
        const left = stack.pop();
        if (!Number.isFinite(left) || !Number.isFinite(right)) throw new Error('Invalid expression');
        switch (token.value) {
          case '+': stack.push(left + right); break;
          case '-': stack.push(left - right); break;
          case '*': stack.push(left * right); break;
          case '/':
            if (right === 0) throw new Error('Division by zero');
            stack.push(left / right);
            break;
          case '^': stack.push(left ** right); break;
          default: throw new Error('Unsupported operator');
        }
        return;
      }

      if (token.type === 'function') {
        const value = stack.pop();
        if (!Number.isFinite(value)) throw new Error('Invalid function input');
        stack.push(applyFunction(token.value, value, angleMode));
      }
    });

    if (stack.length !== 1 || !Number.isFinite(stack[0])) throw new Error('Evaluation failed');
    return stack[0];
  }

  function applyFunction(fn, value, angleMode) {
    const rad = angleMode === 'DEG' ? value * Math.PI / 180 : value;
    switch (fn) {
      case 'neg': return -value;
      case 'sin': return Math.sin(rad);
      case 'cos': return Math.cos(rad);
      case 'tan': return Math.tan(rad);
      case 'log':
        if (value <= 0) throw new Error('Invalid log');
        return Math.log10(value);
      case 'ln':
        if (value <= 0) throw new Error('Invalid ln');
        return Math.log(value);
      case 'sqrt':
        if (value < 0) throw new Error('Invalid sqrt');
        return Math.sqrt(value);
      default: throw new Error('Unknown function');
    }
  }

  function evaluateExpression(expression, angleMode) {
    const tokens = tokenize(expression);
    return evaluateRpn(toRpn(tokens), angleMode);
  }

  function tokensToExpression(tokens) {
    return tokens.map((token) => token.value).join('') || '0';
  }

  buttonGrid.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.value) appendValue(target.dataset.value);
    if (target.dataset.operator) appendOperator(target.dataset.operator);
    if (target.dataset.function) appendValue(target.dataset.function);
    if (target.dataset.constant) appendValue(target.dataset.constant);

    switch (target.dataset.action) {
      case 'clear': clearAll(); break;
      case 'delete': deleteLast(); break;
      case 'calculate': calculate(); break;
      case 'percent': percentCurrent(); break;
      case 'negate': negateCurrent(); break;
      default: break;
    }
  });

  angleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.angleMode = button.dataset.angleMode;
      preview();
      updateUI();
    });
  });

  document.addEventListener('keydown', (event) => {
    const { key, ctrlKey, metaKey } = event;
    if (ctrlKey || metaKey) return;

    if (/^[0-9]$/.test(key) || key === '.') { event.preventDefault(); appendValue(key); return; }
    if (['+', '-', '*', '/', '^'].includes(key)) { event.preventDefault(); appendOperator(key); return; }
    if (key === '(' || key === ')') { event.preventDefault(); appendValue(key); return; }
    if (key === '%') { event.preventDefault(); percentCurrent(); return; }
    if (key === 'Enter' || key === '=') { event.preventDefault(); calculate(); return; }
    if (key === 'Backspace') { event.preventDefault(); deleteLast(); return; }
    if (key === 'Delete' || key === 'Escape') { event.preventDefault(); clearAll(); return; }
    if (key.toLowerCase() === 'p') { event.preventDefault(); appendValue('pi'); return; }
    if (key.toLowerCase() === 'e') { event.preventDefault(); appendValue('e'); return; }
    if (key.toLowerCase() === 'r') { event.preventDefault(); appendValue('sqrt'); return; }
    if (key.toLowerCase() === 's') { event.preventDefault(); appendValue('sin'); return; }
    if (key.toLowerCase() === 'c') { event.preventDefault(); appendValue('cos'); return; }
    if (key.toLowerCase() === 't') { event.preventDefault(); appendValue('tan'); return; }
    if (key.toLowerCase() === 'l') { event.preventDefault(); appendValue('log'); return; }
    if (key.toLowerCase() === 'n') { event.preventDefault(); appendValue('ln'); return; }
  });

  window.CalculatorEvaluator = { evaluateExpression };
  updateUI();
})();
