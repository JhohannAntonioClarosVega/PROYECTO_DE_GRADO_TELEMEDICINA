// Runs the real admin screens and load hook with synthetic React, time and Supabase.
// No configured client, network connection or real patient/administrator is imported.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const screenPath = name => path.resolve('app/(admin)', `${name}.tsx`);
const sourceFor = name => fs.readFileSync(screenPath(name), 'utf8');
const hookPath = path.resolve('hooks/use-admin-load.ts');
const adminId = 'synthetic-admin';

function compile(source) {
  return ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const specialties = tag => [
  { id: `synthetic-specialty-${tag}`, name: `Synthetic specialty ${tag}` },
  { id: 'synthetic-specialty-other', name: 'Synthetic specialty other' },
];
function doctor(group, tag = 'initial') {
  return {
    id: `synthetic-${group}-${tag}`, license_number: `Synthetic license ${tag}`,
    is_active: group === 'active', rejection_reason: group === 'rejected' ? `Synthetic rejection ${tag}` : null,
    title_document_url: 'https://example.invalid/synthetic-document.pdf',
    specialty_id: `synthetic-specialty-${tag}`,
    profiles: { full_name: `Synthetic ${group} doctor ${tag}`, identity_card: 'Synthetic ID', email: 'synthetic@example.invalid', phone_number: 'Synthetic phone' },
    specialties: specialties(tag)[0],
  };
}
const reportRows = tag => tag === 'newest' ? [
  { id: 'synthetic-t1', urgency_level: 'Critical', status: 'waiting' },
  { id: 'synthetic-t2', urgency_level: 'Medium', status: 'completed' },
  { id: 'synthetic-t3', urgency_level: 'Low', status: 'pending' },
  { id: 'synthetic-t4', urgency_level: 'Low', status: 'in_progress' },
] : [{ id: 'synthetic-initial', urgency_level: 'Low', status: 'completed' }];

class FakeDatabase {
  constructor({ respectAbort = false } = {}) {
    this.requests = []; this.respectAbort = respectAbort;
    this.supabase = {
      auth: { getUser: () => this.request('auth').promise },
      from: table => {
        assert.ok(['profiles', 'specialties', 'doctors', 'triages'].includes(table), `Unexpected table: ${table}`);
        const database = this;
        const details = { table, operation: 'select', filters: [], orders: [] };
        let request;
        return {
          select(columns) { details.columns = columns; return this; },
          eq(column, value) { details.filters.push({ operator: 'eq', column, value }); return this; },
          is(column, value) { details.filters.push({ operator: 'is', column, value }); return this; },
          not(column, operator, value) { details.filters.push({ operator: 'not', column, comparison: operator, value }); return this; },
          order(column, options) { details.orders.push({ column, options }); return this; },
          insert(value) { details.operation = 'insert'; details.value = value; return this; },
          update(value) { details.operation = 'update'; details.value = value; return this; },
          delete() { details.operation = 'delete'; return this; },
          abortSignal(signal) { details.signal = signal; return this; },
          single() { return this; },
          maybeSingle() { return this; },
          then(yes, no) {
            if (!request) {
              let kind = table;
              if (details.operation !== 'select') kind = `write:${table}:${details.operation}`;
              else if (table === 'doctors') {
                const active = details.filters.find(filter => filter.column === 'is_active')?.value;
                kind = active ? 'activeDoctors' : details.filters.some(filter => filter.operator === 'not') ? 'rejectedDoctors' : 'pendingDoctors';
              }
              request = database.request(kind, details);
            }
            return request.promise.then(yes, no);
          },
        };
      },
      channel: () => { throw new Error('These admin screens must not add subscriptions'); },
    };
  }
  request(kind, details = {}) {
    const response = deferred();
    const request = { kind, ...details, settled: false, promise: response.promise };
    request.resolve = value => { request.settled = true; response.resolve(value); };
    request.reject = error => { request.settled = true; response.reject(error); };
    this.requests.push(request);
    if (this.respectAbort && request.signal && !kind.startsWith('write:')) {
      const abort = () => request.reject(Object.assign(new Error('Synthetic read cancelled'), { name: 'AbortError' }));
      if (request.signal.aborted) abort();
      else request.signal.addEventListener('abort', abort, { once: true });
      const remove = () => request.signal.removeEventListener('abort', abort);
      request.promise.then(remove, remove);
    }
    return request;
  }
  calls(kind) { return this.requests.filter(request => request.kind === kind); }
  pending(kind) { return this.requests.filter(request => !request.settled && (!kind || request.kind === kind)); }
  get writes() { return this.requests.filter(request => request.kind.startsWith('write:')); }
  answer(request, tag = 'initial', overrides = {}) {
    const data = {
      auth: { user: { id: adminId } }, profiles: { role: 'admin' },
      specialties: specialties(tag), pendingDoctors: [doctor('pending', tag)],
      activeDoctors: [doctor('active', tag)], rejectedDoctors: [doctor('rejected', tag)],
      triages: reportRows(tag),
    };
    request.resolve(overrides[request.kind] || { data: data[request.kind] ?? null, error: null });
  }
}

class AdminHarness {
  constructor(name, database = new FakeDatabase(), source = sourceFor(name)) {
    this.name = name; this.database = database; this.hooks = []; this.cursor = 0;
    this.effects = []; this.mounted = true; this.dirty = false; this.time = 0;
    this.sequence = 0; this.timers = new Map(); this.messages = []; this.navigation = [];
    this.lateStateUpdates = 0; this.renderCount = 0; this.actions = new Set(); this.actionErrors = [];
    const hook = factory => {
      const index = this.cursor++;
      if (!(index in this.hooks)) this.hooks[index] = factory();
      return this.hooks[index];
    };
    const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
    const react = {
      useState: initial => {
        const state = hook(() => ({ value: typeof initial === 'function' ? initial() : initial }));
        state.set ||= value => {
          if (!this.mounted) { this.lateStateUpdates++; return; }
          const next = typeof value === 'function' ? value(state.value) : value;
          if (!Object.is(next, state.value)) { state.value = next; this.dirty = true; }
        };
        return [state.value, state.set];
      },
      useRef: value => hook(() => ({ current: value })),
      useCallback: (callback, dependencies) => {
        const state = hook(() => ({ callback, dependencies }));
        if (!same(state.dependencies, dependencies)) Object.assign(state, { callback, dependencies });
        return state.callback;
      },
      useMemo: (factory, dependencies) => {
        const state = hook(() => ({ value: factory(), dependencies }));
        if (!same(state.dependencies, dependencies)) Object.assign(state, { value: factory(), dependencies });
        return state.value;
      },
      useEffectEvent: callback => {
        const state = hook(() => ({ callback })); state.callback = callback;
        state.event ||= (...args) => state.callback(...args);
        return state.event;
      },
      useEffect: (effect, dependencies) => {
        const state = hook(() => ({ effect, dependencies: undefined })); state.effect = effect;
        if (!same(state.dependencies, dependencies)) this.effects.push(() => {
          state.cleanup?.(); state.dependencies = dependencies; state.cleanup = effect();
        });
      },
    };
    react.useLayoutEffect = react.useEffect;
    const jsx = (type, props, key) => ({ type: typeof type === 'function' && type.name === 'SyntheticPicker' ? 'Picker' : type, props: props || {}, key });
    const native = Object.fromEntries(['ActivityIndicator', 'FlatList', 'Modal', 'RefreshControl', 'SafeAreaView', 'ScrollView', 'Text', 'TextInput', 'TouchableOpacity', 'View'].map(value => [value, value]));
    native.Platform = { OS: 'web' }; native.StyleSheet = { create: value => value };
    const dependencies = {
      react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
      'react-native': native, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
      '@expo/vector-icons': { Ionicons: 'Ionicons' },
      '@react-native-picker/picker': { Picker: Object.assign(function SyntheticPicker() {}, { Item: 'PickerItem' }) },
      'react-native-webview': { WebView: 'WebView' },
      'expo-router': { router: { back: () => this.navigation.push('back'), push: value => this.navigation.push(value), replace: value => this.navigation.push(value) } },
      '@/lib/supabase': { supabase: database.supabase },
      '@/components/CustomModal': { __esModule: true, default: 'CustomModal' },
    };
    const environment = {
      AbortController, Date,
      console: { error: (...values) => this.messages.push(values), warn: (...values) => this.messages.push(values), log: () => {} },
      setTimeout: (callback, duration) => this.addTimer(callback, duration, false),
      clearTimeout: id => this.timers.delete(id),
      setInterval: (callback, duration) => this.addTimer(callback, duration, true),
      clearInterval: id => this.timers.delete(id),
    };
    const execute = (sourceText, filename) => {
      const module = { exports: {} };
      vm.runInNewContext(compile(sourceText), {
        ...environment, module, exports: module.exports,
        require: dependency => {
          assert.ok(Object.hasOwn(dependencies, dependency), `Unexpected import in isolated screen: ${dependency}`);
          return dependencies[dependency];
        },
      }, { filename });
      return module.exports;
    };
    if (fs.existsSync(hookPath)) dependencies['@/hooks/use-admin-load'] = execute(fs.readFileSync(hookPath, 'utf8'), hookPath);
    this.component = execute(source, screenPath(name)).default;
    this.render();
  }
  render() {
    if (!this.mounted) return;
    this.dirty = false; this.cursor = 0; this.effects = []; this.renderCount++;
    this.tree = this.component();
    for (const effect of this.effects) effect();
    this.effects = [];
  }
  async settle() {
    for (let i = 0; i < 100; i++) { await Promise.resolve(); if (this.mounted && this.dirty) this.render(); }
    assert.equal(this.mounted && this.dirty, false, 'The actual screen must settle without an effect loop');
    assert.deepEqual(this.actionErrors, [], 'Administrative callbacks must not reject without handling');
  }
  addTimer(callback, duration, repeating) {
    const id = ++this.sequence; this.timers.set(id, { callback, due: this.time + duration, duration, repeating }); return id;
  }
  async advance(duration) {
    const until = this.time + duration; let count = 0;
    while (true) {
      const next = [...this.timers].filter(([, timer]) => timer.due <= until).sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
      if (!next) break;
      assert.ok(++count < 100, 'No continuous administrative timer loop is permitted');
      const [id, timer] = next; this.time = timer.due;
      if (timer.repeating) timer.due += timer.duration; else this.timers.delete(id);
      timer.callback(); await this.settle();
    }
    this.time = until; await this.settle();
  }
  nodes(tree) {
    if (arguments.length === 0) tree = this.tree;
    if (!tree || typeof tree !== 'object') return [];
    if (Array.isArray(tree)) return tree.flatMap(value => this.nodes(value));
    if ((tree.type === 'Modal' || tree.type === 'CustomModal') && !tree.props.visible) return [tree];
    const children = this.nodes(tree.props.children);
    if (tree.type === 'FlatList') for (const item of tree.props.data) children.push(...this.nodes(tree.props.renderItem({ item })));
    return [tree, ...children];
  }
  text(tree) {
    if (arguments.length === 0) tree = this.tree;
    if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
    if (!tree || typeof tree !== 'object') return '';
    if (Array.isArray(tree)) return tree.map(value => this.text(value)).join(' ');
    if ((tree.type === 'Modal' || tree.type === 'CustomModal') && !tree.props.visible) return '';
    let text = this.text(tree.props.children);
    if (tree.type === 'CustomModal') text += ` ${tree.props.title} ${tree.props.message}`;
    if (tree.type === 'FlatList') text += tree.props.data.map(item => this.text(tree.props.renderItem({ item }))).join(' ');
    return text;
  }
  get modal() { return this.nodes().find(node => node.type === 'CustomModal' && node.props.visible); }
  get list() { return this.nodes().find(node => node.type === 'FlatList'); }
  get rows() { return Array.from(this.list?.props.data || []); }
  get spinner() { return this.nodes().some(node => node.type === 'ActivityIndicator'); }
  get refreshButton() { return this.nodes().find(node => node.type === 'TouchableOpacity' && this.nodes(node).some(child => child.type === 'Ionicons' && child.props.name === 'refresh')); }
  get refreshHandler() { assert.ok(this.refreshButton, 'Refresh must remain reachable'); return this.refreshButton.props.onPress; }
  get inputs() { return this.nodes().filter(node => node.type === 'TextInput'); }
  get addInput() { return this.inputs.find(node => node.props.placeholder?.startsWith('Ej:')); }
  invoke(callback, ...args) {
    const result = callback(...args);
    if (result && typeof result.then === 'function') {
      this.actions.add(result);
      result.then(() => this.actions.delete(result), error => { this.actions.delete(result); this.actionErrors.push(error); });
    }
    return result;
  }
  async press(callback, ...args) { this.invoke(callback, ...args); await this.settle(); }
  async refresh() { await this.press(this.refreshHandler); }
  async tab(group) {
    const pattern = { pending: /^Pendientes \(/, active: /^Activos \(/, rejected: /^Rechazados \(/ }[group];
    const button = this.nodes().find(node => node.type === 'TouchableOpacity' && pattern.test(this.text(node).trim()));
    assert.ok(button); await this.press(button.props.onPress);
  }
  button(label, tree = this.tree) {
    const button = this.nodes(tree).find(node => node.type === 'TouchableOpacity' && this.text(node).trim() === label);
    assert.ok(button, `Missing public action ${label}`); return button;
  }
  iconButton(icon, tree = this.tree) {
    const button = this.nodes(tree).find(node => node.type === 'TouchableOpacity' && this.nodes(node).some(child => child.type === 'Ionicons' && child.props.name === icon));
    assert.ok(button, `Missing public icon action ${icon}`); return button;
  }
  async complete(tag = 'initial', { kinds, exclude = new Set(), overrides = {} } = {}) {
    for (let i = 0; i < 30; i++) {
      await this.settle();
      const pending = this.database.pending().filter(request => !request.kind.startsWith('write:') && !request.signal?.aborted && !exclude.has(request) && (!kinds || kinds.includes(request.kind)));
      if (!pending.length) return;
      for (const request of pending) this.database.answer(request, tag, overrides);
    }
    assert.fail('A finite read must not continuously duplicate administrative queries');
  }
  replayEffects() {
    for (const hook of this.hooks) hook.cleanup?.();
    for (const hook of this.hooks) if (hook.effect) hook.cleanup = hook.effect();
  }
  unmount() { for (const hook of this.hooks) hook.cleanup?.(); this.mounted = false; this.dirty = false; }
  assertClean() {
    assert.equal(this.timers.size, 0, 'Unmount must cancel read deadlines');
    assert.equal(this.lateStateUpdates, 0, 'Old operations must never set state after unmount');
    assert.deepEqual(this.actionErrors, []);
  }
}

async function ready(name, options) {
  const database = new FakeDatabase(options); const screen = new AdminHarness(name, database);
  await screen.complete(); return { database, screen };
}

async function checkDashboardOrder(source) {
  const database = new FakeDatabase(); const screen = new AdminHarness('dashboard', database, source);
  await screen.complete();
  const refresh = screen.refreshHandler;
  await screen.press(refresh); await screen.complete('obsolete', { kinds: ['auth', 'profiles', 'specialties', 'pendingDoctors', 'activeDoctors'] });
  const old = database.pending('rejectedDoctors')[0]; assert.ok(old);
  await screen.press(refresh); await screen.advance(30000);
  await screen.complete('newest', { exclude: new Set([old]) });
  assert.match(screen.text(), /Synthetic pending doctor newest/);
  database.answer(old, 'obsolete'); await screen.settle();
  assert.doesNotMatch(screen.text(), /Synthetic pending doctor obsolete/, 'An obsolete dashboard snapshot must not overwrite the latest complete snapshot');
  screen.unmount(); screen.assertClean();
}

async function dashboardScenarios(scenario) {
  await scenario('dashboard: initial authorized snapshot contains all three doctor groups', async () => {
    const { database, screen } = await ready('dashboard');
    assert.match(screen.text(), /Synthetic pending doctor initial/);
    assert.deepEqual(database.requests.map(request => request.kind), ['auth', 'profiles', 'specialties', 'pendingDoctors', 'activeDoctors', 'rejectedDoctors']);
    await screen.tab('active'); assert.match(screen.text(), /Synthetic active doctor initial/);
    await screen.tab('rejected'); assert.match(screen.text(), /Synthetic rejected doctor initial/);
    assert.equal(database.requests.length, 6);
    screen.unmount(); screen.assertClean();
  });
  await scenario('dashboard: reverse-order reload completion cannot restore an obsolete snapshot', () => checkDashboardOrder());
  await scenario('dashboard: rapid refreshes coalesce into one final read rather than duplicate every query', async () => {
    const { database, screen } = await ready('dashboard'); const refresh = screen.refreshHandler;
    await screen.press(refresh);
    screen.invoke(refresh); screen.invoke(refresh); await screen.settle();
    assert.equal(database.calls('auth').length, 2);
    const old = database.pending('auth')[0]; database.answer(old, 'obsolete'); await screen.settle();
    await screen.complete('newest');
    assert.equal(database.calls('auth').length, 3);
    assert.equal(database.calls('pendingDoctors').length, 2);
    assert.match(screen.text(), /Synthetic pending doctor newest/);
    screen.unmount(); screen.assertClean();
  });
  await scenario('dashboard: changing a local tab during refresh neither refetches nor mixes lists', async () => {
    const { database, screen } = await ready('dashboard');
    const tab = screen.nodes().find(node => node.type === 'TouchableOpacity' && /^Activos\s*\(/.test(screen.text(node).trim())).props.onPress;
    await screen.refresh(); await screen.press(tab); await screen.complete('newest');
    assert.match(screen.text(), /Synthetic active doctor newest/);
    assert.equal(database.calls('auth').length, 2);
    screen.unmount(); screen.assertClean();
  });
  await scenario('dashboard: a partial read error preserves the last complete snapshot and recovers', async () => {
    const { database, screen } = await ready('dashboard'); await screen.refresh();
    await screen.complete('partial', { kinds: ['auth', 'profiles', 'specialties', 'pendingDoctors'] });
    const failing = database.pending('activeDoctors')[0]; assert.ok(failing); failing.reject(new Error('Synthetic network failure')); await screen.settle();
    assert.doesNotMatch(screen.text(), /Synthetic pending doctor partial/);
    assert.match(screen.text(), /Synthetic pending doctor initial/);
    assert.ok(screen.modal || screen.nodes().some(node => node.props.accessibilityRole === 'alert'));
    await screen.refresh(); await screen.complete('newest'); assert.match(screen.text(), /Synthetic pending doctor newest/);
    screen.unmount(); screen.assertClean();
  });
  for (const kind of ['auth', 'profiles', 'specialties', 'pendingDoctors', 'activeDoctors', 'rejectedDoctors']) {
    await scenario(`dashboard: unmount during ${kind} ignores its late result`, async () => {
      const database = new FakeDatabase(); const screen = new AdminHarness('dashboard', database);
      const order = ['auth', 'profiles', 'specialties', 'pendingDoctors', 'activeDoctors', 'rejectedDoctors'];
      await screen.complete('initial', { kinds: order.slice(0, order.indexOf(kind)) });
      const request = database.pending(kind)[0]; assert.ok(request); const count = database.requests.length;
      screen.unmount(); database.answer(request); await screen.settle();
      assert.equal(database.requests.length, count); screen.assertClean();
    });
  }
  await scenario('dashboard: a changed authorization context cannot expose the previous admin snapshot', async () => {
    const { database, screen } = await ready('dashboard'); await screen.refresh();
    const auth = database.pending('auth')[0]; auth.resolve({ data: { user: { id: 'synthetic-other-user' } }, error: null }); await screen.settle();
    const profile = database.pending('profiles')[0]; profile.resolve({ data: { role: 'patient' }, error: null }); await screen.settle();
    assert.doesNotMatch(screen.text(), /Synthetic pending doctor initial/);
    assert.match(screen.text(), /Acceso Restringido/);
    screen.unmount(); screen.assertClean();
  });
  await scenario('dashboard: a superseded former-lifecycle load cannot update the remounted effect', async () => {
    const database = new FakeDatabase(); const screen = new AdminHarness('dashboard', database); await screen.settle();
    const old = database.pending('auth')[0]; screen.replayEffects(); await screen.settle();
    await screen.complete('newest', { exclude: new Set([old]) }); database.answer(old, 'obsolete'); await screen.settle();
    assert.match(screen.text(), /Synthetic pending doctor newest/); assert.equal(database.calls('profiles').length, 1);
    screen.unmount(); screen.assertClean();
  });
  await scenario('dashboard: approval preserves its payload and never continues into a closed screen', async () => {
    const { database, screen } = await ready('dashboard');
    await screen.press(screen.button('Aprobar').props.onPress);
    const write = database.pending('write:doctors:update')[0]; assert.ok(write);
    assert.deepEqual(JSON.parse(JSON.stringify(write.value)), { is_active: true, specialty_id: 'synthetic-specialty-initial', rejection_reason: null });
    assert.equal(write.filters[0].value, 'synthetic-pending-initial');
    const count = database.requests.length; screen.unmount(); database.answer(write); await screen.settle();
    assert.equal(database.requests.length, count); assert.equal(database.writes.length, 1); screen.assertClean();
  });
  await scenario('dashboard: specialty reassignment preserves its captured selection and delayed reload action', async () => {
    const { database, screen } = await ready('dashboard'); await screen.tab('active');
    const picker = screen.nodes().find(node => node.type === 'Picker'); assert.ok(picker);
    await screen.press(picker.props.onValueChange, 'synthetic-specialty-other');
    await screen.press(screen.button('Guardar Especialidad').props.onPress);
    const write = database.pending('write:doctors:update')[0]; assert.ok(write);
    assert.deepEqual(JSON.parse(JSON.stringify(write.value)), { specialty_id: 'synthetic-specialty-other' });
    database.answer(write); await screen.settle();
    assert.equal(database.calls('auth').length, 1); assert.equal(screen.modal?.props.title, 'Especialidad Actualizada');
    await screen.press(screen.modal.props.onConfirm); await screen.complete('newest');
    assert.match(screen.text(), /Synthetic active doctor newest/); assert.equal(database.writes.length, 1);
    screen.unmount(); screen.assertClean();
  });
  await scenario('dashboard: rejection preserves the trimmed reason and post-write reload', async () => {
    const { database, screen } = await ready('dashboard'); await screen.press(screen.button('Rechazar').props.onPress);
    const input = screen.inputs.find(node => node.props.multiline); assert.ok(input);
    await screen.press(input.props.onChangeText, '  Synthetic rejection reason  ');
    await screen.press(screen.button('Confirmar Rechazo').props.onPress);
    const write = database.pending('write:doctors:update')[0]; assert.ok(write);
    assert.deepEqual(JSON.parse(JSON.stringify(write.value)), { is_active: false, rejection_reason: 'Synthetic rejection reason' });
    database.answer(write); await screen.settle(); await screen.complete('newest');
    assert.equal(database.writes.length, 1); assert.equal(screen.modal?.props.title, 'Solicitud Rechazada');
    screen.unmount(); screen.assertClean();
  });
  await scenario('dashboard: idle time and ordinary renders do not add administrative requests', async () => {
    const { database, screen } = await ready('dashboard'); const count = database.requests.length;
    screen.render(); await screen.settle(); await screen.advance(120000);
    assert.equal(database.requests.length, count); assert.equal(screen.timers.size, 0);
    screen.unmount(); screen.assertClean();
  });
  await dashboardMutationScenarios(scenario);
}

async function reportsScenarios(scenario) {
  await catalogReadScenarios('reports', scenario);
  await scenario('reports: statistics and simulated revenue retain the original calculations', async () => {
    const { database, screen } = await ready('reports'); await screen.refresh(); await screen.complete('newest');
    assert.match(screen.text(), /4/); assert.match(screen.text(), /150\s+Bs/); assert.match(screen.text(), /3\s+pagos exitosos/);
    const percentages = screen.nodes().filter(node => node.type === 'Text').map(node => screen.text(node).replace(/\s/g, '')).filter(text => /^\d+%$/.test(text));
    assert.deepEqual(percentages, ['25%', '25%', '50%']); assert.equal(database.calls('triages').length, 2);
    screen.unmount(); screen.assertClean();
  });
}

async function specialtiesScenarios(scenario) {
  await catalogReadScenarios('specialties', scenario);
  await scenario('specialties: initial catalog uses the existing name order and has no writes', async () => {
    const { database, screen } = await ready('specialties');
    assert.match(screen.text(), /Synthetic specialty initial/); assert.equal(database.writes.length, 0);
    assert.equal(database.calls('specialties')[0].orders[0].column, 'name');
    screen.unmount(); screen.assertClean();
  });
  await specialtyMutationScenarios(scenario);
}

async function dashboardMutationScenarios(scenario) {
  await scenario('dashboard: an unresponsive initial authorization times out without exposing an admin snapshot', async () => {
    const database = new FakeDatabase(); const screen = new AdminHarness('dashboard', database); await screen.settle();
    const old = database.pending('auth')[0]; await screen.advance(30000);
    assert.ok(screen.nodes().some(node => node.props.accessibilityRole === 'alert'));
    assert.equal(screen.rows.length, 0);
    await screen.press(screen.button('Reintentar').props.onPress);
    await screen.complete('newest', { exclude: new Set([old]) });
    database.answer(old, 'obsolete'); await screen.settle(); assert.match(screen.text(), /Synthetic pending doctor newest/);
    screen.unmount(); screen.assertClean();
  });
  await scenario('dashboard: repeated approval presses send one unchanged administrative write', async () => {
    const { database, screen } = await ready('dashboard'); const approve = screen.button('Aprobar').props.onPress;
    screen.invoke(approve); screen.invoke(approve); await screen.settle();
    assert.equal(database.writes.length, 1);
    database.answer(database.writes[0]); await screen.settle(); await screen.complete();
    assert.equal(screen.modal.props.title, 'Médico Aprobado');
    await screen.press(screen.modal.props.onCancel); assert.equal(screen.modal, undefined);
    screen.unmount(); screen.assertClean();
  });
  await scenario('dashboard: an older approval cannot clear another doctor busy indicator or replace its result', async () => {
    const { database, screen } = await ready('dashboard');
    await screen.press(screen.button('Aprobar').props.onPress); const older = database.writes[0];
    await screen.tab('rejected');
    await screen.press(screen.button('Reconsiderar y Habilitar Médico').props.onPress); const newer = database.writes[1];
    database.answer(older); await screen.settle(); await screen.complete();
    const busy = screen.nodes().filter(node => node.type === 'TouchableOpacity' && node.props.disabled);
    assert.ok(busy.some(node => screen.nodes(node).some(child => child.type === 'ActivityIndicator')));
    assert.equal(newer.settled, false);
    assert.notEqual(screen.modal?.props.title, 'Médico Aprobado');
    database.answer(newer); await screen.settle(); await screen.complete('newest');
    assert.equal(screen.modal.props.title, 'Médico Aprobado'); assert.equal(database.writes.length, 2);
    screen.unmount(); screen.assertClean();
  });
  await scenario('dashboard: a confirmed write with a failed reload preserves the read error instead of claiming refreshed data', async () => {
    const { database, screen } = await ready('dashboard'); await screen.press(screen.button('Aprobar').props.onPress);
    database.answer(database.writes[0]); await screen.settle();
    await screen.complete('initial', { kinds: ['auth', 'profiles', 'specialties'] });
    database.pending('pendingDoctors')[0].reject(new Error('Synthetic failed reload')); await screen.settle();
    assert.equal(screen.modal.props.title, 'Error al Cargar Datos'); assert.equal(database.writes.length, 1);
    assert.match(screen.text(), /Synthetic pending doctor initial/);
    screen.unmount(); screen.assertClean();
  });
  await scenario('dashboard: an old rejection does not clear a newer rejection form', async () => {
    const database = new FakeDatabase(); const screen = new AdminHarness('dashboard', database);
    const overrides = { pendingDoctors: { data: [doctor('pending'), doctor('pending', 'second')], error: null } };
    await screen.complete('initial', { overrides });
    await screen.press(screen.button('Rechazar').props.onPress);
    await screen.press(screen.inputs.find(node => node.props.multiline).props.onChangeText, 'Synthetic first reason');
    await screen.press(screen.button('Confirmar Rechazo').props.onPress);
    const secondCard = screen.list.props.renderItem({ item: screen.rows[1] });
    await screen.press(screen.button('Rechazar', secondCard).props.onPress);
    await screen.press(screen.inputs.find(node => node.props.multiline).props.onChangeText, 'Synthetic second reason');
    database.answer(database.writes[0]); await screen.settle(); await screen.complete('initial', { overrides });
    assert.equal(screen.inputs.find(node => node.props.multiline).props.value, 'Synthetic second reason');
    assert.notEqual(screen.modal?.props.title, 'Solicitud Rechazada');
    screen.unmount(); screen.assertClean();
  });
  await scenario('dashboard: an acknowledged former-admin operation cannot reload or change the new admin context', async () => {
    const { database, screen } = await ready('dashboard'); await screen.press(screen.button('Aprobar').props.onPress);
    const write = database.writes[0]; await screen.refresh();
    const auth = database.pending('auth')[0]; auth.resolve({ data: { user: { id: 'synthetic-second-admin' } }, error: null });
    await screen.settle(); await screen.complete('newest'); const count = database.requests.length;
    database.answer(write); await screen.settle();
    assert.equal(database.requests.length, count); assert.match(screen.text(), /Synthetic pending doctor newest/);
    assert.notEqual(screen.modal?.props.title, 'Médico Aprobado');
    screen.unmount(); screen.assertClean();
  });
}

async function specialtyMutationScenarios(scenario) {
  const json = value => JSON.parse(JSON.stringify(value));
  await scenario('specialties: adding trims the captured name, writes once and refreshes the catalog', async () => {
    const { database, screen } = await ready('specialties');
    await screen.press(screen.addInput.props.onChangeText, '  Synthetic added specialty  ');
    const add = screen.iconButton('add').props.onPress; screen.invoke(add); screen.invoke(add); await screen.settle();
    assert.equal(database.writes.length, 1); const write = database.writes[0];
    assert.deepEqual(json(write.value), [{ name: 'Synthetic added specialty' }]);
    database.answer(write); await screen.settle(); await screen.complete('newest');
    assert.equal(screen.addInput.props.value, ''); assert.equal(screen.modal.props.title, 'Éxito');
    screen.unmount(); screen.assertClean();
  });
  await scenario('specialties: a late add response cannot erase a newer add draft', async () => {
    const { database, screen } = await ready('specialties');
    await screen.press(screen.addInput.props.onChangeText, 'Synthetic first add');
    await screen.press(screen.iconButton('add').props.onPress);
    await screen.press(screen.addInput.props.onChangeText, 'Synthetic newer draft');
    database.answer(database.writes[0]); await screen.settle(); await screen.complete('newest');
    assert.equal(screen.addInput.props.value, 'Synthetic newer draft'); assert.notEqual(screen.modal?.props.title, 'Éxito');
    screen.unmount(); screen.assertClean();
  });
  await scenario('specialties: editing keeps the same captured id and trimmed update payload', async () => {
    const { database, screen } = await ready('specialties'); await screen.press(screen.iconButton('pencil').props.onPress);
    const edit = screen.inputs.find(node => node !== screen.addInput);
    await screen.press(edit.props.onChangeText, '  Synthetic edited name  ');
    await screen.press(screen.iconButton('checkmark').props.onPress); const write = database.writes[0];
    assert.deepEqual(json(write.value), { name: 'Synthetic edited name' });
    assert.equal(write.filters[0].value, 'synthetic-specialty-initial');
    database.answer(write); await screen.settle(); await screen.complete('newest');
    assert.equal(screen.inputs.length, 1); assert.equal(database.writes.length, 1);
    screen.unmount(); screen.assertClean();
  });
  await scenario('specialties: an old edit cannot close or erase an edit opened for another item', async () => {
    const { database, screen } = await ready('specialties'); await screen.press(screen.iconButton('pencil').props.onPress);
    await screen.press(screen.inputs.find(node => node !== screen.addInput).props.onChangeText, 'Synthetic first edit');
    await screen.press(screen.iconButton('checkmark').props.onPress);
    await screen.press(screen.iconButton('pencil').props.onPress);
    await screen.press(screen.inputs.find(node => node !== screen.addInput).props.onChangeText, 'Synthetic second edit');
    database.answer(database.writes[0]); await screen.settle(); await screen.complete('initial');
    assert.equal(screen.inputs.find(node => node !== screen.addInput).props.value, 'Synthetic second edit');
    screen.unmount(); screen.assertClean();
  });
  await scenario('specialties: delete confirmation is bound to its item and cannot be reused', async () => {
    const { database, screen } = await ready('specialties'); await screen.press(screen.iconButton('trash').props.onPress);
    const confirm = screen.modal.props.onConfirm; screen.invoke(confirm); screen.invoke(confirm); await screen.settle();
    assert.equal(database.writes.length, 1); const write = database.writes[0];
    assert.equal(write.operation, 'delete'); assert.equal(write.filters[0].value, 'synthetic-specialty-initial');
    database.answer(write); await screen.settle(); await screen.complete('newest');
    assert.match(screen.text(), /Synthetic specialty newest/);
    screen.unmount(); screen.assertClean();
  });
  await scenario('specialties: a superseded delete dialog cannot delete its old item', async () => {
    const { database, screen } = await ready('specialties'); await screen.press(screen.iconButton('trash').props.onPress);
    const obsolete = screen.modal.props.onConfirm;
    const trashButtons = screen.nodes().filter(node => node.type === 'TouchableOpacity' && screen.nodes(node).some(child => child.type === 'Ionicons' && child.props.name === 'trash'));
    await screen.press(trashButtons[1].props.onPress); await screen.press(obsolete);
    assert.equal(database.writes.length, 0); assert.match(screen.modal.props.message, /Synthetic specialty other/);
    screen.unmount(); screen.assertClean();
  });
  for (const mode of ['add', 'edit', 'delete']) {
    for (const outcome of ['resolve', 'reject']) {
      await scenario(`specialties: ${mode} ${outcome} after unmount never touches state or reloads`, async () => {
        const { database, screen } = await ready('specialties');
        if (mode === 'add') {
          await screen.press(screen.addInput.props.onChangeText, 'Synthetic closed add');
          await screen.press(screen.iconButton('add').props.onPress);
        } else if (mode === 'edit') {
          await screen.press(screen.iconButton('pencil').props.onPress);
          await screen.press(screen.iconButton('checkmark').props.onPress);
        } else {
          await screen.press(screen.iconButton('trash').props.onPress);
          await screen.press(screen.modal.props.onConfirm);
        }
        const write = database.writes[0]; const count = database.requests.length; screen.unmount();
        if (outcome === 'resolve') database.answer(write); else write.reject(new Error('Synthetic delayed write failure'));
        await screen.settle(); assert.equal(database.requests.length, count); screen.assertClean();
      });
    }
  }
  await scenario('specialties: a failed post-add read cannot be hidden by a success modal or retry the insert', async () => {
    const { database, screen } = await ready('specialties');
    await screen.press(screen.addInput.props.onChangeText, 'Synthetic confirmed add');
    await screen.press(screen.iconButton('add').props.onPress); database.answer(database.writes[0]); await screen.settle();
    database.pending('specialties')[0].reject(new Error('Synthetic reload failure')); await screen.settle();
    assert.equal(screen.modal.props.title, 'Error de Carga'); assert.equal(database.writes.length, 1);
    await screen.refresh(); await screen.complete('newest'); assert.equal(database.writes.length, 1);
    screen.unmount(); screen.assertClean();
  });
}

async function catalogReadScenarios(name, scenario) {
  const kind = name === 'reports' ? 'triages' : 'specialties';
  const newest = name === 'reports' ? /150\s+Bs/ : /Synthetic specialty newest/;
  const initial = name === 'reports' ? /50\s+Bs/ : /Synthetic specialty initial/;
  await scenario(`${name}: an initial read error is not displayed as an empty successful report or catalog`, async () => {
    const database = new FakeDatabase(); const screen = new AdminHarness(name, database); await screen.settle();
    database.pending(kind)[0].reject(new Error('Synthetic initial network failure')); await screen.settle();
    assert.ok(screen.nodes().some(node => node.props.accessibilityRole === 'alert'));
    if (name === 'reports') assert.doesNotMatch(screen.text(), /Pacientes Atendidos/);
    else assert.doesNotMatch(screen.text(), /No hay especialidades registradas/);
    await screen.refresh(); await screen.complete('newest'); assert.match(screen.text(), newest);
    screen.unmount(); screen.assertClean();
  });
  await scenario(`${name}: a superseded read arriving after the latest result cannot overwrite it`, async () => {
    const { database, screen } = await ready(name);
    const refresh = screen.refreshHandler;
    await screen.press(refresh);
    const old = database.pending(kind)[0]; assert.ok(old);
    await screen.press(refresh); await screen.advance(30000);
    await screen.complete('newest', { exclude: new Set([old]) });
    assert.match(screen.text(), newest);
    database.answer(old, 'obsolete'); await screen.settle();
    assert.match(screen.text(), newest);
    screen.unmount(); screen.assertClean();
  });
  await scenario(`${name}: rapid refresh presses share one trailing read`, async () => {
    const { database, screen } = await ready(name); const refresh = screen.refreshHandler;
    await screen.press(refresh); const old = database.pending(kind)[0];
    screen.invoke(refresh); screen.invoke(refresh); await screen.settle();
    assert.equal(database.calls(kind).length, 2);
    database.answer(old, 'obsolete'); await screen.settle(); await screen.complete('newest');
    assert.equal(database.calls(kind).length, 3);
    assert.match(screen.text(), newest);
    screen.unmount(); screen.assertClean();
  });
  await scenario(`${name}: a burst before the first microtask avoids starting obsolete requests`, async () => {
    const { database, screen } = await ready(name); const refresh = screen.refreshHandler;
    screen.invoke(refresh); screen.invoke(refresh); screen.invoke(refresh); await screen.settle();
    assert.equal(database.calls(kind).length, 2);
    await screen.complete('newest'); assert.match(screen.text(), newest);
    screen.unmount(); screen.assertClean();
  });
  await scenario(`${name}: network failure retains the last valid snapshot and a refresh recovers`, async () => {
    const { database, screen } = await ready(name); await screen.refresh();
    database.pending(kind)[0].reject(new Error('Synthetic network failure')); await screen.settle();
    assert.match(screen.text(), initial);
    assert.ok(screen.modal || screen.nodes().some(node => node.props.accessibilityRole === 'alert'));
    await screen.refresh(); await screen.complete('newest'); assert.match(screen.text(), newest);
    screen.unmount(); screen.assertClean();
  });
  for (const outcome of ['resolve', 'reject']) {
    await scenario(`${name}: unmount rejects a pending read's late ${outcome}`, async () => {
      const { database, screen } = await ready(name); await screen.refresh();
      const old = database.pending(kind)[0]; const count = database.requests.length;
      screen.unmount();
      if (outcome === 'resolve') database.answer(old, 'obsolete'); else old.reject(new Error('Synthetic late error'));
      await screen.settle(); assert.equal(database.requests.length, count);
      screen.assertClean();
    });
  }
  await scenario(`${name}: cleanup and effect restart isolate a former screen context`, async () => {
    const database = new FakeDatabase(); const screen = new AdminHarness(name, database);
    await screen.settle(); const old = database.pending(kind)[0]; assert.ok(old);
    screen.replayEffects(); await screen.settle();
    await screen.complete('newest', { exclude: new Set([old]) });
    database.answer(old, 'obsolete'); await screen.settle(); assert.match(screen.text(), newest);
    screen.unmount(); screen.assertClean();
  });
  await scenario(`${name}: a valid fifteen-second response completes without continuous polling`, async () => {
    const { database, screen } = await ready(name); await screen.refresh();
    const old = database.pending(kind)[0]; await screen.advance(15000);
    assert.equal(database.calls(kind).length, 2);
    database.answer(old, 'newest'); await screen.settle(); assert.match(screen.text(), newest);
    screen.unmount(); screen.assertClean();
  });
  await scenario(`${name}: a hung request times out at thirty seconds and permits recovery`, async () => {
    const { database, screen } = await ready(name); await screen.refresh(); const old = database.pending(kind)[0];
    await screen.advance(29999); assert.equal(old.signal.aborted, false);
    await screen.advance(1); assert.equal(old.signal.aborted, true);
    assert.match(screen.text(), initial);
    assert.ok(screen.modal || screen.nodes().some(node => node.props.accessibilityRole === 'alert'));
    await screen.refresh(); await screen.complete('newest', { exclude: new Set([old]) });
    old.reject(new Error('Synthetic expired error')); await screen.settle(); assert.match(screen.text(), newest);
    screen.unmount(); screen.assertClean();
  });
  await scenario(`${name}: idle time and rerenders never duplicate reads`, async () => {
    const { database, screen } = await ready(name); const count = database.requests.length;
    screen.render(); await screen.settle(); await screen.advance(120000);
    assert.equal(database.requests.length, count); assert.equal(database.writes.length, 0);
    screen.unmount(); screen.assertClean();
  });
  await scenario(`${name}: a successful empty response remains a valid zero or empty result`, async () => {
    const { database, screen } = await ready(name); await screen.refresh();
    database.pending(kind)[0].resolve({ data: [], error: null }); await screen.settle();
    assert.equal(screen.nodes().some(node => node.props.accessibilityRole === 'alert'), false);
    if (name === 'reports') {
      assert.match(screen.text(), /0\s+Bs/);
      const percentages = screen.nodes().filter(node => node.type === 'Text').map(node => screen.text(node).replace(/\s/g, '')).filter(text => /^\d+%$/.test(text));
      assert.deepEqual(percentages, ['0%', '0%', '0%']);
    } else assert.match(screen.text(), /No hay especialidades registradas/);
    screen.unmount(); screen.assertClean();
  });
}

async function run(stage = process.argv[2]) {
  let passed = 0;
  const scenario = async (name, body) => { await body(); passed++; console.log(`PASS ${name}`); };
  const stages = { dashboard: dashboardScenarios, reports: reportsScenarios, specialties: specialtiesScenarios };
  if (stage) { assert.ok(Object.hasOwn(stages, stage), 'Choose dashboard, reports or specialties'); await stages[stage](scenario); }
  else for (const suite of Object.values(stages)) await suite(scenario);
  console.log(`Passed ${passed} isolated admin concurrency scenarios${stage ? ` (${stage})` : ''} (real TSX/hook; synthetic React, clock and Supabase).`);
}

module.exports = { AdminHarness, FakeDatabase, checkDashboardOrder, run };
if (require.main === module) {
  const watchdog = setTimeout(() => { console.error('FAIL A synthetic scenario remained pending.'); process.exit(1); }, 15000);
  run().then(() => clearTimeout(watchdog), error => { clearTimeout(watchdog); console.error(error); process.exitCode = 1; });
}
