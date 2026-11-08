// Isolated regression checks for the real videocall TSX component.
// React, the clock, camera, router and Supabase are synthetic: no network or real records.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const sourcePath = path.resolve('app/(doctor)/videocall.tsx');
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  },
}).outputText;

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

const doctorId = 'synthetic-doctor';
const patientId = id => `synthetic-patient-${id}`;
const appointmentId = id => `synthetic-appointment-${id}`;
const params = (id, role = 'doctor') => ({ triageId: id, patientId: patientId(id), role });
function triage(id) {
  return {
    id, patient_id: patientId(id), status: 'in_progress', urgency_level: 'Low',
    reported_symptoms: `Synthetic symptoms ${id}`, ai_recommendation: `Synthetic recommendation ${id}`,
    patients: { id: patientId(id), blood_type: 'O+', allergies: 'Synthetic none', profiles: { full_name: `Synthetic ${id}` } },
  };
}
function appointment(id) {
  return { id: appointmentId(id), triage_id: id, patient_id: patientId(id), doctor_id: doctorId };
}
function record(id) {
  return {
    id: `synthetic-record-${id}`, appointment_id: appointmentId(id), patient_id: patientId(id), doctor_id: doctorId,
    diagnosis: `Synthetic diagnosis ${id}`, treatment_plan: `Synthetic treatment ${id}`,
    clinical_notes: `Synthetic notes ${id}`, created_at: '2026-01-01T00:00:00.000Z',
  };
}

class FakeDatabase {
  constructor() {
    this.tables = { triages: [], appointments: [], medical_records: [] };
    this.requests = [];
    this.writes = [];
    this.channels = [];
    this.overrides = [];
    this.deferredSubscriptions = new Set();
    this.sendOverrides = new Map();
    this.authResponse = Promise.resolve({ data: { user: { id: doctorId } }, error: null });
    this.supabase = {
      auth: { getUser: () => this.authResponse },
      from: table => this.query(table),
      channel: name => {
        const database = this;
        const channel = {
          name, handlers: [], removed: false, sent: [],
          on(type, filter, callback) { this.handlers.push({ type, filter, callback }); return this; },
          subscribe(callback) {
            this.subscriptionCallback = callback;
            if (callback && !database.deferredSubscriptions.has(name)) void Promise.resolve().then(() => callback('SUBSCRIBED'));
            return this;
          },
          notify(status = 'SUBSCRIBED') { this.subscriptionCallback?.(status); },
          send(message) {
            this.sent.push(message);
            const responses = database.sendOverrides.get(name);
            return Promise.resolve(responses?.length ? responses.shift() : 'ok');
          },
          unsubscribe() { this.removed = true; return Promise.resolve('ok'); },
        };
        this.channels.push(channel);
        return channel;
      },
      removeChannel: channel => { channel.removed = true; return Promise.resolve('ok'); },
    };
  }

  add(id) {
    this.tables.triages.push(triage(id));
    this.tables.appointments.push(appointment(id));
    return this;
  }

  query(table) {
    assert.ok(Object.hasOwn(this.tables, table), `Unexpected synthetic table: ${table}`);
    const database = this;
    return {
      table, filters: {}, operation: 'select', mode: 'many',
      select() { return this; },
      eq(name, value) { this.filters[name] = value; return this; },
      limit(count) { this.maximum = count; return this; },
      order() { return this; },
      abortSignal(signal) { this.signal = signal; return this; },
      insert(values) { this.operation = 'insert'; this.values = values; return this; },
      update(values) { this.operation = 'update'; this.values = values; return this; },
      maybeSingle() { this.mode = 'maybeSingle'; return database.execute(this); },
      single() { this.mode = 'single'; return database.execute(this); },
      then(onFulfilled, onRejected) { return database.execute(this).then(onFulfilled, onRejected); },
    };
  }

  execute(query) {
    if (query.result) return query.result;
    const matches = row => Object.entries(query.filters).every(([name, value]) => row[name] === value);
    const key = query.filters.id || query.filters.triage_id || query.filters.appointment_id;
    const request = { table: query.table, operation: query.operation, key, filters: { ...query.filters }, signal: query.signal };
    this.requests.push(request);
    if (query.operation !== 'select') this.writes.push({ ...request, values: query.values });
    const syntheticInsertId = `synthetic-insert-${this.writes.length}`;
    const index = this.overrides.findIndex(item => item.table === query.table && item.operation === query.operation && item.key === key);
    let response;
    if (index >= 0) response = this.overrides.splice(index, 1)[0].response;
    else if (query.operation === 'insert') response = Promise.resolve({ data: { id: syntheticInsertId, ...query.values }, error: null });
    else if (query.operation === 'update') {
      const rows = this.tables[query.table].filter(matches).map(row => ({ ...row, ...query.values }));
      response = Promise.resolve({ data: query.mode === 'many' ? rows : rows[0] || null, error: null });
    }
    else {
      // Network reads produce independent snapshots, not references to the fake store.
      let rows = this.tables[query.table].filter(matches).map(row => structuredClone(row));
      if (query.maximum !== undefined) rows = rows.slice(0, query.maximum);
      const single = query.mode !== 'many';
      const error = single && (rows.length > 1 || (query.mode === 'single' && rows.length === 0))
        ? { code: 'PGRST116', message: 'Synthetic non-unique or missing row' } : null;
      response = Promise.resolve({ data: error ? null : single ? rows[0] || null : rows, error });
    }
    query.result = Promise.resolve(response).then(result => {
      if (!result.error && query.operation === 'insert') {
        const values = { id: syntheticInsertId, ...query.values };
        this.tables[query.table].push(values);
      }
      if (!result.error && query.operation === 'update') {
        for (const row of this.tables[query.table].filter(matches)) Object.assign(row, query.values);
      }
      return result;
    });
    return query.result;
  }

  deferNext(table, operation, key) {
    const pending = deferred();
    this.overrides.push({ table, operation, key, response: pending.promise });
    return pending;
  }

  respondNext(table, operation, key, response) {
    this.overrides.push({ table, operation, key, response: Promise.resolve(response) });
  }

  deferSend(name) {
    const response = deferred();
    const responses = this.sendOverrides.get(name) || [];
    responses.push(response.promise);
    this.sendOverrides.set(name, responses);
    return response;
  }

  emit(channel, type, payload) {
    assert.ok(channel, 'Expected an owned synthetic channel');
    // Removed handlers may already be queued in an SDK; deliberately deliver them too.
    for (const handler of channel.handlers) if (handler.type === type) handler.callback(payload);
  }

  channel(name) { return this.channels.findLast(channel => channel.name === name && !channel.removed); }
  inserts() { return this.writes.filter(write => write.operation === 'insert'); }
  updates() { return this.writes.filter(write => write.operation === 'update'); }
}

class ScreenHarness {
  constructor(database, route = params('A')) {
    this.database = database;
    this.params = route;
    this.current = null;
    this.root = null;
    this.child = null;
    this.tree = null;
    this.dirty = false;
    this.mounted = true;
    this.time = 0;
    this.timerSequence = 0;
    this.timers = new Map();
    this.navigation = [];
    this.warnings = [];
    this.lateStateUpdates = 0;
    this.cameraRequests = [];
    this.cameraOverrides = [];
    this.streams = [];

    const hook = initial => {
      assert.ok(this.current, 'Hooks must run inside the screen');
      const owner = this.current;
      const index = owner.cursor++;
      if (!(index in owner.hooks)) owner.hooks[index] = initial();
      return [owner.hooks[index], owner];
    };
    const same = (before, after) => before && after && before.length === after.length && before.every((value, index) => Object.is(value, after[index]));
    const react = {
      useState: initial => {
        const [state, owner] = hook(() => ({ value: typeof initial === 'function' ? initial() : initial }));
        if (!state.set) state.set = next => {
          if (!owner.active) { this.lateStateUpdates++; return; }
          const value = typeof next === 'function' ? next(state.value) : next;
          if (!Object.is(value, state.value)) { state.value = value; this.dirty = true; }
        };
        return [state.value, state.set];
      },
      useRef: initial => hook(() => ({ current: initial }))[0],
      useCallback: (callback, dependencies) => {
        const [state] = hook(() => ({ callback, dependencies }));
        if (!same(state.dependencies, dependencies)) { state.callback = callback; state.dependencies = dependencies; }
        return state.callback;
      },
      useMemo: (factory, dependencies) => {
        const [state] = hook(() => ({ value: factory(), dependencies }));
        if (!same(state.dependencies, dependencies)) { state.value = factory(); state.dependencies = dependencies; }
        return state.value;
      },
      useEffect: (effect, dependencies) => {
        const [state, owner] = hook(() => ({ dependencies: undefined }));
        if (!same(state.dependencies, dependencies)) {
          owner.effects.push(() => {
            if (state.cleanup) state.cleanup();
            state.dependencies = dependencies;
            state.cleanup = effect();
          });
        }
      },
      useEffectEvent: callback => {
        const [state] = hook(() => ({ callback }));
        state.callback = callback;
        if (!state.stable) state.stable = (...args) => state.callback(...args);
        return state.stable;
      },
    };
    const jsx = (type, props, key) => ({ type, props: props || {}, key });
    const native = Object.fromEntries(['ActivityIndicator', 'ScrollView', 'Text', 'TextInput', 'TouchableOpacity', 'View'].map(name => [name, name]));
    native.Platform = { OS: 'web' };
    native.StyleSheet = { create: styles => styles };
    const dependencies = {
      react,
      'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
      'react-native': native,
      'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
      'react-native-webview': { WebView: 'WebView' },
      'expo-camera': { Camera: { requestCameraPermissionsAsync: async () => ({ status: 'granted' }), requestMicrophonePermissionsAsync: async () => ({ status: 'granted' }) } },
      '@expo/vector-icons': { Ionicons: 'Ionicons' },
      'expo-router': {
        useLocalSearchParams: () => this.params,
        router: { push: destination => this.navigation.push(destination), replace: destination => this.navigation.push(destination) },
      },
      '@/lib/supabase': { supabase: database.supabase },
      '@/components/CustomModal': { __esModule: true, default: 'CustomModal' },
    };
    const module = { exports: {} };
    const context = {
      module, exports: module.exports, AbortController, URLSearchParams,
      require: name => {
        assert.ok(Object.hasOwn(dependencies, name), `Unexpected module import: ${name}`);
        return dependencies[name];
      },
      console: { warn: (...args) => this.warnings.push(args), error: (...args) => this.warnings.push(args), log() {} },
      setTimeout: (callback, duration) => this.addTimer(callback, duration, false),
      clearTimeout: id => this.timers.delete(id),
      setInterval: (callback, duration) => this.addTimer(callback, duration, true),
      clearInterval: id => this.timers.delete(id),
      navigator: { mediaDevices: { getUserMedia: options => {
        this.cameraRequests.push(options);
        if (this.cameraOverrides.length) return this.cameraOverrides.shift();
        const stream = this.fakeStream();
        return Promise.resolve(stream);
      } } },
      window: { open() { throw new Error('Unexpected external navigation'); } },
    };
    vm.runInNewContext(compiled, context, { filename: sourcePath });
    this.root = this.instance(module.exports.default, {});
    this.render();
  }

  fakeStream() {
    const track = { stopped: false, stop() { this.stopped = true; } };
    const stream = { track, getTracks: () => [track] };
    this.streams.push(stream);
    return stream;
  }

  instance(component, props, key) { return { component, props, key, cursor: 0, hooks: [], effects: [], active: true }; }
  execute(instance) {
    instance.cursor = 0;
    instance.effects = [];
    this.current = instance;
    const tree = instance.component(instance.props);
    this.current = null;
    return tree;
  }
  cleanup(instance) {
    if (!instance) return;
    instance.active = false;
    for (const state of instance.hooks) if (state.cleanup) state.cleanup();
  }
  render() {
    if (!this.mounted) return;
    this.dirty = false;
    const outer = this.execute(this.root);
    if (typeof outer.type === 'function') {
      if (!this.child || this.child.key !== outer.key || this.child.component !== outer.type) {
        this.cleanup(this.child);
        this.child = this.instance(outer.type, outer.props, outer.key);
      }
      this.child.props = outer.props;
      this.tree = this.execute(this.child);
    } else this.tree = outer;
    for (const instance of [this.root, this.child].filter(Boolean)) {
      for (const effect of instance.effects) effect();
      instance.effects = [];
    }
  }
  async settle() {
    for (let turn = 0; turn < 120; turn++) {
      await Promise.resolve();
      if (this.dirty && this.mounted) this.render();
    }
    assert.equal(this.dirty && this.mounted, false, 'The screen must settle without a render loop');
  }
  async route(route) { this.params = typeof route === 'string' ? params(route) : route; this.render(); await this.settle(); }
  addTimer(callback, duration, repeating) {
    const id = ++this.timerSequence;
    this.timers.set(id, { callback, due: this.time + duration, duration, repeating });
    return id;
  }
  async advance(duration) {
    const until = this.time + duration;
    let iterations = 0;
    while (true) {
      const next = [...this.timers.entries()].filter(([, timer]) => timer.due <= until).sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
      if (!next) break;
      assert.ok(++iterations < 100, 'Unexpected timer loop');
      const [id, timer] = next;
      this.time = timer.due;
      if (timer.repeating) timer.due += timer.duration;
      else this.timers.delete(id);
      timer.callback();
      await this.settle();
    }
    this.time = until;
    await this.settle();
  }
  nodes(tree) {
    if (arguments.length === 0) tree = this.tree;
    if (!tree || typeof tree !== 'object') return [];
    if (Array.isArray(tree)) return tree.flatMap(node => this.nodes(node));
    return [tree, ...this.nodes(tree.props?.children)];
  }
  text(tree) {
    if (arguments.length === 0) tree = this.tree;
    if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
    if (!tree || typeof tree !== 'object') return '';
    if (Array.isArray(tree)) return tree.map(node => this.text(node)).join(' ');
    return this.text(tree.props?.children);
  }
  button(text) {
    const button = this.nodes().find(node => node.type === 'TouchableOpacity' && text.test(this.text(node)));
    assert.ok(button, `Expected button ${text}; visible: ${this.text()}`);
    return button;
  }
  icon(name) {
    const button = this.nodes().find(node => node.type === 'TouchableOpacity' && this.nodes(node).some(child => child.type === 'Ionicons' && child.props.name === name));
    assert.ok(button, `Expected icon button ${name}`);
    return button;
  }
  input(placeholder) {
    const input = this.nodes().find(node => node.type === 'TextInput' && placeholder.test(node.props.placeholder));
    assert.ok(input, `Expected input ${placeholder}`);
    return input;
  }
  modal() { return this.nodes().find(node => node.type === 'CustomModal')?.props; }
  async openNotes() { this.icon('document-text').props.onPress(); await this.settle(); }
  async fill(id = 'A') {
    if (!this.nodes().some(node => node.type === 'TextInput' && /diagn/.test(node.props.placeholder))) await this.openNotes();
    this.input(/diagn/).props.onChangeText(`Synthetic diagnosis ${id}`);
    this.input(/Medicamentos/).props.onChangeText(`Synthetic treatment ${id}`);
    this.input(/Notas/).props.onChangeText(`Synthetic notes ${id}`);
    await this.settle();
  }
  unmount() { this.cleanup(this.child); this.cleanup(this.root); this.mounted = false; this.dirty = false; }
  assertClean() {
    assert.equal(this.lateStateUpdates, 0, 'Obsolete instances must not attempt state updates');
    assert.equal(this.timers.size, 0, 'Unmount must cancel every owned timer');
    assert.ok(this.database.channels.every(channel => channel.removed), 'Unmount must remove every owned channel');
    assert.ok(this.streams.every(stream => stream.track.stopped), 'Unmount must stop every acquired camera stream');
  }
}

async function setup(id = 'A', role = 'doctor') {
  const database = new FakeDatabase().add('A').add('B');
  const screen = new ScreenHarness(database, params(id, role));
  await screen.settle();
  return { database, screen };
}

async function run() {
  let passed = 0;
  async function scenario(name, body) {
    await body();
    passed++;
    console.log(`PASS ${name}`);
  }

  await scenario('Clinical drafts, panels, modal and call status reset on A -> B -> A', async () => {
    const { database, screen } = await setup();
    await screen.fill();
    const staleSave = screen.button(/Guardar y Finalizar/).props.onPress;
    await screen.route('B');
    assert.ok(screen.text().includes('Estableciendo canal seguro'));
    assert.equal(screen.modal().visible, false);
    assert.ok(!screen.nodes().some(node => node.type === 'TextInput' && /diagn/.test(node.props.placeholder)), 'B must not inherit the open clinical panel from A');
    await screen.openNotes();
    assert.equal(screen.input(/diagn/).props.value, '');
    assert.equal(screen.input(/Medicamentos/).props.value, '');
    assert.equal(screen.input(/Notas/).props.value, '');
    await staleSave();
    await screen.settle();
    assert.equal(database.writes.length, 0, 'An old saved button callback must not write for A after B opens');
    await screen.fill('B');
    await screen.route('A');
    await screen.openNotes();
    assert.equal(screen.input(/diagn/).props.value, '');
    screen.unmount();
    screen.assertClean();
  });

  await scenario('A late triage read is aborted and cannot replace the B summary', async () => {
    const database = new FakeDatabase().add('A').add('B');
    const pending = database.deferNext('triages', 'select', 'A');
    const screen = new ScreenHarness(database);
    await screen.settle();
    const oldRead = database.requests.find(request => request.table === 'triages' && request.key === 'A');
    await screen.route('B');
    pending.resolve({ data: triage('A'), error: null });
    await screen.settle();
    await screen.openNotes();
    assert.ok(screen.text().includes('Synthetic symptoms B'));
    assert.ok(!screen.text().includes('Synthetic symptoms A'));
    assert.equal(oldRead.signal?.aborted, true, 'Read cancellation must be requested when its consultation closes');
    screen.unmount();
    screen.assertClean();
  });

  await scenario('An old A read cannot update the new A instance after A -> B -> A', async () => {
    const database = new FakeDatabase().add('A').add('B');
    const pending = database.deferNext('triages', 'select', 'A');
    const oldA = { ...triage('A'), reported_symptoms: 'Synthetic obsolete A response' };
    const screen = new ScreenHarness(database);
    await screen.settle();
    await screen.route('B');
    database.tables.triages[0].reported_symptoms = 'Synthetic fresh A response';
    await screen.route('A');
    pending.resolve({ data: oldA, error: null });
    await screen.settle();
    await screen.openNotes();
    assert.ok(screen.text().includes('Synthetic fresh A response'));
    assert.ok(!screen.text().includes('Synthetic obsolete A response'));
    screen.unmount();
    screen.assertClean();
  });

  await scenario('Consecutive patient consultations load only their own appointment and saved prescription', async () => {
    const database = new FakeDatabase().add('A').add('B');
    database.tables.medical_records.push(record('A'), record('B'));
    const screen = new ScreenHarness(database, params('A', 'patient'));
    await screen.settle();
    await screen.openNotes();
    assert.ok(screen.text().includes('Synthetic diagnosis A'));
    const oldModal = screen.modal();
    await screen.route(params('B', 'patient'));
    assert.ok(!screen.text().includes('Synthetic diagnosis A'));
    oldModal.onConfirm?.();
    await screen.settle();
    assert.ok(!screen.text().includes('Mi Consulta'), 'An old A modal must not open the B record panel');
    await screen.openNotes();
    assert.ok(screen.text().includes('Synthetic diagnosis B'));
    assert.ok(!screen.text().includes('Synthetic diagnosis A'));
    await screen.route(params('A', 'patient'));
    await screen.openNotes();
    assert.ok(screen.text().includes('Synthetic diagnosis A'), 'Previously persisted records must remain available on return');
    assert.equal(database.writes.length, 0, 'Loading persisted prescriptions is read-only');
    screen.unmount();
    screen.assertClean();
  });

  await scenario('Late patient record and removed A Realtime listeners cannot end or change B', async () => {
    const database = new FakeDatabase().add('A').add('B');
    const pending = database.deferNext('medical_records', 'select', appointmentId('A'));
    const screen = new ScreenHarness(database, params('A', 'patient'));
    await screen.settle();
    const oldCallChannel = database.channel('rt_call_A');
    const oldRecordChannel = database.channel(`rt_db_${appointmentId('A')}`);
    await screen.route(params('B', 'patient'));
    pending.resolve({ data: record('A'), error: null });
    database.emit(oldCallChannel, 'broadcast', { payload: { triageId: 'A', patientId: patientId('A'), appointmentId: appointmentId('A'), ...record('A') } });
    if (oldRecordChannel) database.emit(oldRecordChannel, 'postgres_changes', { new: record('A') });
    await screen.settle();
    assert.equal(database.writes.length, 0, 'Stale events must not trigger completion writes');
    assert.ok(!screen.text().includes('Consulta Finalizada'));
    await screen.openNotes();
    assert.ok(!screen.text().includes('Synthetic diagnosis A'));
    assert.equal(screen.modal().visible, false);
    screen.unmount();
    screen.assertClean();
  });

  await scenario('The active B broadcast channel rejects explicit A and mismatched appointment identities', async () => {
    const { database, screen } = await setup('B', 'patient');
    const channel = database.channel('rt_call_B');
    database.emit(channel, 'broadcast', { payload: { triageId: 'A', patientId: patientId('A'), appointmentId: appointmentId('A'), ...record('A') } });
    await screen.settle();
    database.emit(channel, 'broadcast', { payload: { triageId: 'B', patientId: patientId('B'), appointmentId: appointmentId('A'), ...record('A') } });
    await screen.settle();
    assert.equal(database.writes.length, 0);
    assert.ok(!screen.text().includes('Consulta Finalizada'));
    await screen.openNotes();
    assert.ok(!screen.text().includes('Synthetic diagnosis A'));
    screen.unmount();
    screen.assertClean();
  });

  await scenario('Opening the patient panel during an ongoing poll shares one read and unmount cancels its result', async () => {
    const database = new FakeDatabase().add('A').add('B');
    const pending = database.deferNext('medical_records', 'select', appointmentId('A'));
    const screen = new ScreenHarness(database, params('A', 'patient'));
    await screen.settle();
    await screen.openNotes();
    await screen.advance(5000);
    assert.equal(database.requests.filter(request => request.table === 'medical_records').length, 1, 'Concurrent polling/manual reads should share the same in-flight request');
    const request = database.requests.find(item => item.table === 'medical_records');
    screen.unmount();
    assert.equal(request.signal.aborted, true);
    pending.resolve({ data: record('A'), error: null });
    await screen.settle();
    assert.equal(database.writes.length, 0);
    screen.assertClean();
  });

  await scenario('A B database notification rereads the validated B prescription instead of trusting its payload', async () => {
    const { database, screen } = await setup('B', 'patient');
    database.tables.medical_records.push(record('B'));
    database.emit(database.channel(`rt_db_${appointmentId('B')}`), 'postgres_changes', { new: record('A') });
    await screen.settle();
    await screen.openNotes();
    assert.ok(screen.text().includes('Synthetic diagnosis B'));
    assert.ok(!screen.text().includes('Synthetic diagnosis A'));
    screen.unmount();
    screen.assertClean();
  });

  await scenario('An unidentified legacy broadcast cannot copy A text into a pending B consultation', async () => {
    const { database, screen } = await setup('B', 'patient');
    database.emit(database.channel('rt_call_B'), 'broadcast', { payload: { diagnosis: 'Synthetic diagnosis A', treatment_plan: 'Synthetic treatment A' } });
    await screen.settle();
    assert.equal(database.writes.length, 0, 'An unidentified legacy event is not authority to complete a pending B');
    assert.ok(!screen.text().includes('Consulta Finalizada'));
    await screen.openNotes();
    assert.ok(!screen.text().includes('Synthetic diagnosis A'));
    assert.ok(!screen.text().includes('Synthetic treatment A'));
    screen.unmount();
    screen.assertClean();
  });

  for (const status of ['completed', 'resolved']) {
    await scenario(`A legacy broadcast for B already ${status} permits neutral closure without an invented prescription`, async () => {
      const { database, screen } = await setup('B', 'patient');
      database.tables.triages[1].status = status;
      database.emit(database.channel('rt_call_B'), 'broadcast', { payload: { diagnosis: 'Synthetic diagnosis A', treatment_plan: 'Synthetic treatment A' } });
      await screen.settle();
      assert.equal(database.writes.length, 0, 'An already confirmed closure needs no new completion write');
      assert.ok(screen.text().includes('Consulta Finalizada'));
      await screen.openNotes();
      assert.ok(!screen.text().includes('Synthetic diagnosis A'));
      assert.ok(!screen.text().includes('Synthetic treatment A'));
      assert.ok(!screen.text().includes('DATOS DE LA RECETA'), 'A neutral closure must not fabricate a clinical record');
      screen.unmount();
      screen.assertClean();
    });
  }

  await scenario('A legacy broadcast uses the persisted B record rather than unidentified message text', async () => {
    const { database, screen } = await setup('B', 'patient');
    database.tables.medical_records.push(record('B'));
    database.emit(database.channel('rt_call_B'), 'broadcast', { payload: { diagnosis: 'Synthetic diagnosis A', treatment_plan: 'Synthetic treatment A' } });
    await screen.settle();
    await screen.openNotes();
    assert.ok(screen.text().includes('Synthetic diagnosis B'));
    assert.ok(!screen.text().includes('Synthetic diagnosis A'));
    assert.ok(database.writes.every(write => write.key === 'B'));
    assert.equal(database.inserts().length, 0);
    screen.unmount();
    screen.assertClean();
  });

  await scenario('An explicitly identified B broadcast can still display its own temporary prescription', async () => {
    const { database, screen } = await setup('B', 'patient');
    database.emit(database.channel('rt_call_B'), 'broadcast', {
      payload: {
        triageId: 'B', patientId: patientId('B'), appointmentId: appointmentId('B'),
        diagnosis: 'Synthetic temporary diagnosis B', treatment_plan: 'Synthetic temporary treatment B',
      },
    });
    await screen.settle();
    assert.ok(screen.text().includes('Consulta Finalizada'));
    await screen.openNotes();
    assert.ok(screen.text().includes('Synthetic temporary diagnosis B'));
    assert.ok(screen.text().includes('Synthetic temporary treatment B'));
    assert.equal(database.inserts().length, 0, 'Receiving a temporary record never inserts clinical data');
    screen.unmount();
    screen.assertClean();
  });

  await scenario('Chat reply, connection delay and call timer belong to their consultation and stop on unmount', async () => {
    const { screen } = await setup();
    screen.icon('chatbubbles').props.onPress();
    await screen.settle();
    screen.input(/Escribe/).props.onChangeText('Synthetic private message A');
    await screen.settle();
    screen.icon('send').props.onPress();
    await screen.settle();
    assert.ok(screen.text().includes('Synthetic private message A'));
    const aTimers = [...screen.timers.keys()];
    await screen.advance(500);
    await screen.route('B');
    assert.ok(aTimers.every(id => !screen.timers.has(id)), 'Changing consultation must remove every A timer');
    screen.icon('chatbubbles').props.onPress();
    await screen.settle();
    assert.equal(screen.input(/Escribe/).props.value, '');
    await screen.advance(2200);
    assert.ok(screen.text().includes('Estableciendo canal seguro'), 'B needs its own connection delay');
    assert.ok(!screen.text().includes('Synthetic private message A'));
    assert.ok(!screen.text().includes('ya anot'), 'The simulated reply to A must not reach B');
    screen.unmount();
    await screen.advance(10000);
    screen.assertClean();
  });

  await scenario('A camera promise resolving after A closes stops its own stream', async () => {
    const { screen } = await setup();
    const pending = deferred();
    screen.cameraOverrides.push(pending.promise);
    await screen.advance(3000);
    assert.equal(screen.cameraRequests.length, 1);
    await screen.route('B');
    const oldStream = screen.fakeStream();
    pending.resolve(oldStream);
    await screen.settle();
    assert.equal(oldStream.track.stopped, true);
    await screen.advance(3000);
    assert.equal(screen.cameraRequests.length, 2, 'B acquires its own stream');
    screen.unmount();
    screen.assertClean();
  });

  await scenario('Two save presses before React rerenders produce one clinical INSERT with correct identities', async () => {
    const { database, screen } = await setup();
    await screen.fill();
    const save = screen.button(/Guardar y Finalizar/).props.onPress;
    await Promise.all([save(), save()]);
    await screen.settle();
    assert.equal(database.inserts().length, 1);
    const saved = database.inserts()[0].values;
    assert.equal(saved.patient_id, patientId('A'));
    assert.equal(saved.doctor_id, doctorId);
    assert.equal(saved.appointment_id, appointmentId('A'));
    assert.equal(saved.diagnosis, 'Synthetic diagnosis A');
    assert.ok(screen.text().includes('Consulta Finalizada'));
    await screen.route('B');
    assert.ok(!screen.text().includes('Consulta Finalizada'));
    assert.ok(screen.text().includes('Estableciendo canal seguro'));
    screen.unmount();
    screen.assertClean();
  });

  await scenario('A sent INSERT may finish, but cannot finalize, notify or update B after a route change', async () => {
    const { database, screen } = await setup();
    await screen.fill();
    const pending = database.deferNext('medical_records', 'insert', undefined);
    const savePromise = screen.button(/Guardar y Finalizar/).props.onPress();
    await screen.settle();
    assert.equal(database.inserts().length, 1);
    await screen.route('B');
    pending.resolve({ data: null, error: null });
    await savePromise;
    await screen.settle();
    assert.equal(database.tables.medical_records.length, 1, 'A write already accepted remotely cannot be undone by unmount');
    assert.equal(database.updates().length, 0);
    assert.equal(database.channels.flatMap(channel => channel.sent).length, 0);
    assert.equal(screen.modal().visible, false);
    assert.ok(!screen.text().includes('Consulta Finalizada'));
    await screen.route('A');
    await screen.fill();
    await screen.button(/Guardar y Finalizar/).props.onPress();
    await screen.settle();
    assert.equal(database.inserts().length, 1, 'Returning to A must recognize the accepted record');
    screen.unmount();
    screen.assertClean();
  });

  await scenario('The per-triage save lock survives A -> B -> A while the first INSERT is pending', async () => {
    const { database, screen } = await setup();
    await screen.fill();
    const pending = database.deferNext('medical_records', 'insert', undefined);
    const firstSave = screen.button(/Guardar y Finalizar/).props.onPress();
    await screen.settle();
    await screen.route('B');
    await screen.route('A');
    await screen.fill('A-return');
    const secondSave = screen.button(/Guardar y Finalizar/).props.onPress();
    await screen.settle();
    assert.equal(database.inserts().length, 1, 'A new component instance cannot bypass an in-flight A save');
    pending.resolve({ data: null, error: null });
    await Promise.all([firstSave, secondSave]);
    await screen.settle();
    assert.equal(database.inserts().length, 1);
    screen.unmount();
    screen.assertClean();
  });

  await scenario('A returning A instance cannot end without saving while the first A INSERT is still pending', async () => {
    const { database, screen } = await setup();
    await screen.fill();
    const pending = database.deferNext('medical_records', 'insert', undefined);
    const firstSave = screen.button(/Guardar y Finalizar/).props.onPress();
    await screen.settle();
    await screen.route('B');
    await screen.route('A');
    screen.icon('call').props.onPress();
    await screen.settle();
    const confirm = screen.modal().onConfirm;
    assert.equal(typeof confirm, 'function');
    await confirm();
    await screen.settle();
    assert.equal(database.inserts().length, 1);
    assert.equal(database.updates().length, 0, 'An in-flight clinical save must block end-without-save from another instance');
    assert.equal(database.channels.flatMap(channel => channel.sent).length, 0);
    assert.equal(screen.navigation.length, 0);
    assert.ok(!screen.text().includes('Consulta Finalizada'));
    pending.resolve({ data: null, error: null });
    await firstSave;
    await screen.settle();
    assert.equal(database.updates().length, 0);
    screen.unmount();
    screen.assertClean();
  });

  await scenario('B can save its own record while an already sent A INSERT is still pending', async () => {
    const { database, screen } = await setup();
    await screen.fill();
    const pending = database.deferNext('medical_records', 'insert', undefined);
    const saveA = screen.button(/Guardar y Finalizar/).props.onPress();
    await screen.settle();
    await screen.route('B');
    await screen.fill('B');
    await screen.button(/Guardar y Finalizar/).props.onPress();
    await screen.settle();
    assert.equal(database.inserts().length, 2);
    assert.deepEqual(database.inserts().map(write => write.values.appointment_id), [appointmentId('A'), appointmentId('B')]);
    assert.equal(database.updates().length, 1);
    assert.equal(database.updates()[0].key, 'B');
    pending.resolve({ data: null, error: null });
    await saveA;
    await screen.settle();
    assert.equal(database.updates().length, 1, 'Late A may not issue a new completion write');
    assert.equal(screen.modal().title, 'Historial Guardado');
    screen.unmount();
    screen.assertClean();
  });

  await scenario('Retry after completion failure preserves the confirmed record instead of inserting twice', async () => {
    const { database, screen } = await setup();
    database.respondNext('triages', 'update', 'A', { data: null, error: { code: 'SYNTHETIC_FAILURE', message: 'Synthetic completion unavailable' } });
    await screen.fill();
    await screen.button(/Guardar y Finalizar/).props.onPress();
    await screen.settle();
    assert.equal(database.inserts().length, 1);
    assert.equal(screen.modal().visible, true);
    assert.ok(!screen.text().includes('Consulta Finalizada'));
    await screen.button(/Guardar y Finalizar/).props.onPress();
    await screen.settle();
    assert.equal(database.inserts().length, 1);
    assert.equal(database.tables.medical_records.length, 1);
    assert.ok(screen.text().includes('Consulta Finalizada'));
    screen.unmount();
    screen.assertClean();
  });

  await scenario('Reopening an appointment with a persisted clinical record never inserts a duplicate', async () => {
    const { database, screen } = await setup();
    database.tables.medical_records.push(record('A'));
    await screen.fill('new-draft');
    await screen.button(/Guardar y Finalizar/).props.onPress();
    await screen.settle();
    assert.equal(database.inserts().length, 0);
    assert.equal(database.tables.medical_records[0].diagnosis, 'Synthetic diagnosis A', 'An existing clinical record must not be overwritten by an unrelated draft');
    screen.unmount();
    screen.assertClean();
  });

  await scenario('A late authentication response cannot start a save in a consultation that has closed', async () => {
    const { database, screen } = await setup();
    const auth = deferred();
    database.authResponse = auth.promise;
    await screen.fill();
    const savePromise = screen.button(/Guardar y Finalizar/).props.onPress();
    await screen.settle();
    await screen.route('B');
    auth.resolve({ data: { user: { id: doctorId } }, error: null });
    await savePromise;
    await screen.settle();
    assert.equal(database.writes.length, 0);
    assert.equal(screen.modal().visible, false);
    screen.unmount();
    screen.assertClean();
  });

  await scenario('A detached end-without-save confirmation cannot complete A or navigate away from B', async () => {
    const { database, screen } = await setup();
    screen.icon('call').props.onPress();
    await screen.settle();
    const confirmation = screen.modal().onConfirm;
    assert.equal(typeof confirmation, 'function');
    await screen.route('B');
    await confirmation();
    await screen.settle();
    assert.equal(database.writes.length, 0);
    assert.equal(screen.navigation.length, 0);
    assert.ok(!screen.text().includes('Consulta Finalizada'));
    screen.unmount();
    screen.assertClean();
  });

  await scenario('An ambiguous INSERT result cannot trigger a blind second INSERT', async () => {
    const { database, screen } = await setup();
    database.respondNext('medical_records', 'insert', undefined, { data: null, error: { message: 'Synthetic connection lost after send' } });
    await screen.fill();
    await screen.button(/Guardar y Finalizar/).props.onPress();
    await screen.settle();
    assert.equal(database.inserts().length, 1);
    await screen.button(/Guardar y Finalizar/).props.onPress();
    await screen.settle();
    assert.equal(database.inserts().length, 1);
    assert.equal(database.updates().length, 0);
    assert.equal(screen.modal().visible, true);
    screen.unmount();
    screen.assertClean();
  });

  await scenario('A definite SQL rejection permits one successful retry after its synthetic condition is corrected', async () => {
    const { database, screen } = await setup();
    database.respondNext('medical_records', 'insert', undefined, {
      data: null, error: { code: '23514', message: 'Synthetic check constraint rejected the INSERT' },
    });
    await screen.fill();
    await screen.button(/Guardar y Finalizar/).props.onPress();
    await screen.settle();
    assert.equal(database.inserts().length, 1);
    assert.equal(database.tables.medical_records.length, 0, 'An explicit SQL rejection confirms there was no inserted record');
    assert.equal(database.updates().length, 0);
    assert.equal(screen.modal().visible, true);
    // Removing the one-shot synthetic rejection represents correcting its local condition.
    await screen.button(/Guardar y Finalizar/).props.onPress();
    await screen.settle();
    assert.equal(database.inserts().length, 2, 'A known rejected INSERT must not permanently lock out a legitimate retry');
    assert.equal(database.tables.medical_records.length, 1, 'Exactly one retry succeeds');
    assert.ok(screen.text().includes('Consulta Finalizada'));
    screen.unmount();
    screen.assertClean();
  });

  await scenario('End without saving waits for subscription and send acknowledgement before navigating', async () => {
    const { database, screen } = await setup();
    database.deferredSubscriptions.add('rt_call_A');
    const send = database.deferSend('rt_call_A');
    screen.icon('call').props.onPress();
    await screen.settle();
    let finished = false;
    const end = Promise.resolve(screen.modal().onConfirm()).then(() => { finished = true; });
    await screen.settle();
    const channel = database.channel('rt_call_A');
    assert.ok(channel);
    assert.equal(database.updates().length, 1);
    assert.equal(channel.sent.length, 0);
    assert.equal(finished, false);
    assert.equal(screen.navigation.length, 0, 'Navigation would unmount and cancel a notification not sent yet');
    channel.notify();
    await screen.settle();
    assert.equal(channel.sent.length, 1);
    assert.equal(finished, false);
    assert.equal(screen.navigation.length, 0, 'SUBSCRIBED alone is not a send acknowledgement');
    send.resolve('ok');
    await screen.settle();
    assert.equal(finished, true);
    await end;
    assert.equal(screen.navigation.length, 1);
    assert.equal(screen.navigation[0], '/(doctor)/dashboard');
    assert.equal(channel.removed, true);
    screen.unmount();
    screen.assertClean();
  });

  await scenario('Unmount while a saved record waits for subscription cancels the wait and suppresses late send', async () => {
    const { database, screen } = await setup();
    database.deferredSubscriptions.add('rt_call_A');
    await screen.fill();
    let finished = false;
    const save = Promise.resolve(screen.button(/Guardar y Finalizar/).props.onPress()).then(() => { finished = true; });
    await screen.settle();
    const channel = database.channel('rt_call_A');
    assert.ok(channel);
    assert.equal(database.inserts().length, 1);
    assert.equal(finished, false);
    screen.unmount();
    await screen.settle();
    assert.equal(finished, true, 'Cleanup must release an awaiting notification promise');
    await save;
    channel.notify();
    await screen.settle();
    assert.equal(channel.sent.length, 0);
    assert.equal(screen.navigation.length, 0);
    screen.assertClean();
  });

  await scenario('End notification timeout resolves in five seconds with a notice and explicit return action', async () => {
    const { database, screen } = await setup();
    database.deferredSubscriptions.add('rt_call_A');
    screen.icon('call').props.onPress();
    await screen.settle();
    let finished = false;
    const end = Promise.resolve(screen.modal().onConfirm()).then(() => { finished = true; });
    await screen.settle();
    const channel = database.channel('rt_call_A');
    await screen.advance(4999);
    assert.equal(finished, false);
    await screen.advance(1);
    assert.equal(finished, true, 'A missing subscription acknowledgement must not leave the UI waiting indefinitely');
    await end;
    assert.equal(screen.navigation.length, 0);
    assert.equal(screen.modal().visible, true);
    assert.match(screen.modal().message, /confirm|avis|notific/i);
    assert.equal(database.inserts().length, 0);
    assert.equal(database.updates().length, 1);
    assert.ok(screen.warnings.length > 0, 'Notification failure must be reported');
    channel.notify();
    await screen.settle();
    assert.equal(channel.sent.length, 0, 'A timed-out emitter must ignore a queued late SUBSCRIBED callback');
    screen.modal().onConfirm();
    await screen.settle();
    assert.equal(screen.navigation.length, 1);
    screen.unmount();
    screen.assertClean();
  });

  await scenario('A send error reports an unconfirmed notice while preserving a successfully saved clinical record', async () => {
    const { database, screen } = await setup();
    database.sendOverrides.set('rt_call_A', ['error']);
    await screen.fill();
    await screen.button(/Guardar y Finalizar/).props.onPress();
    await screen.settle();
    assert.equal(database.inserts().length, 1);
    assert.equal(database.tables.medical_records.length, 1);
    assert.equal(database.updates().length, 1);
    assert.equal(screen.modal().visible, true);
    assert.equal(screen.modal().title, 'Historial Guardado');
    assert.match(screen.modal().message, /confirm|avis|notific/i);
    assert.ok(screen.text().includes('Consulta Finalizada'));
    assert.ok(screen.warnings.length > 0);
    screen.unmount();
    screen.assertClean();
  });

  await scenario('A save notification timeout preserves the record and does not masquerade as an INSERT failure', async () => {
    const { database, screen } = await setup();
    database.deferredSubscriptions.add('rt_call_A');
    await screen.fill();
    let finished = false;
    const save = Promise.resolve(screen.button(/Guardar y Finalizar/).props.onPress()).then(() => { finished = true; });
    await screen.settle();
    await screen.advance(5000);
    assert.equal(finished, true);
    await save;
    assert.equal(database.inserts().length, 1);
    assert.equal(database.tables.medical_records.length, 1);
    assert.equal(screen.modal().title, 'Historial Guardado');
    assert.match(screen.modal().message, /confirm|avis|notific/i);
    assert.equal(screen.navigation.length, 0);
    screen.unmount();
    screen.assertClean();
  });

  for (const mismatch of ['triage-patient', 'appointment-patient', 'appointment-doctor', 'appointment-triage', 'ambiguous-appointment', 'record-patient', 'record-doctor']) {
    await scenario(`Saving blocks ${mismatch} identity without INSERT or completion`, async () => {
      const { database, screen } = await setup();
      if (mismatch === 'triage-patient') database.tables.triages[0].patient_id = patientId('B');
      if (mismatch === 'appointment-patient') database.tables.appointments[0].patient_id = patientId('B');
      if (mismatch === 'appointment-doctor') database.tables.appointments[0].doctor_id = 'synthetic-other-doctor';
      if (mismatch === 'appointment-triage') database.respondNext('appointments', 'select', 'A', { data: { ...appointment('A'), triage_id: 'B' }, error: null });
      if (mismatch === 'ambiguous-appointment') database.tables.appointments.push({ ...appointment('A'), id: 'synthetic-duplicate-appointment' });
      if (mismatch.startsWith('record-')) database.tables.medical_records.push({ ...record('A'), [mismatch === 'record-patient' ? 'patient_id' : 'doctor_id']: 'synthetic-wrong-owner' });
      await screen.fill();
      await screen.button(/Guardar y Finalizar/).props.onPress();
      await screen.settle();
      assert.equal(database.inserts().length, 0);
      assert.equal(database.updates().length, 0);
      assert.equal(screen.modal().visible, true, 'Identity errors must be visible to the operator');
      screen.unmount();
      screen.assertClean();
    });
  }

  console.log(`Passed ${passed} isolated videocall scenarios (synthetic hooks; no real browser or services).`);
}

// Keep Node alive long enough to fail, rather than silently exit, if a mocked wait never settles.
const watchdog = setTimeout(() => {
  console.error('Isolated videocall checks did not finish within 15 seconds; an asynchronous wait may be stuck.');
  process.exitCode = 1;
}, 15000);
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => clearTimeout(watchdog));
