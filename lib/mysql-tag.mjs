import { mysqlPool, inspectMySQL, mysqlJSONColumns } from './mysql-connection.mjs';

const fragment = Symbol('sql-fragment');
const quote = (name) => {
  if (typeof name !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/.test(name)) throw new Error('Invalid SQL identifier.');
  return name.split('.').map((part) => `\`${part}\``).join('.');
};

// Implements the tagged query/transaction subset used by this application. SQL stays explicit.
export function mysqlSql(url) {
  const pool = mysqlPool(url); const initialized = new WeakMap();
  const ready = async (connection) => {
    if (!initialized.has(connection.connection)) initialized.set(connection.connection, await inspectMySQL(connection));
  };
  function tag(connection) {
    const run = async (text, values) => {
      const acquired = connection || await pool.getConnection();
      try {
        await ready(acquired);
        const [result, fields] = await acquired.execute(text, values);
        if (!Array.isArray(result)) return Object.assign([], { count: result.affectedRows });
        for (const field of fields || []) if (field.columnType === 1 && field.columnLength === 1) {
          for (const row of result) if (row[field.name] !== null) row[field.name] = Boolean(row[field.name]);
        }
        if (initialized.get(acquired.connection).engine === 'mariadb') for (const field of fields || []) {
          if (mysqlJSONColumns.has(field.orgName || field.name)) for (const row of result) {
            if (typeof row[field.name] === 'string') row[field.name] = JSON.parse(row[field.name]);
          }
        }
        return Object.assign(result, { count: result.length });
      } finally { if (!connection) acquired.release(); }
    };
    const make = (text, values = []) => {
      let promise;
      return { [fragment]: true, text, values, then: (done, fail) => (promise ??= run(text, values)).then(done, fail) };
    };
    const valuePart = (value) => {
      if (value?.[fragment]) return value;
      if (value === undefined) throw new Error('Undefined SQL parameter.');
      return { text: '?', values: [value instanceof Date ? value.toISOString().replace('T', ' ').replace('Z', '') : value] };
    };
    function sql(parts, ...values) {
      if (Array.isArray(parts) && Object.hasOwn(parts, 'raw')) {
        let text = parts[0]; const parameters = [];
        for (let index = 0; index < values.length; index++) {
          const item = valuePart(values[index]); text += item.text + parts[index + 1]; parameters.push(...item.values);
        }
        return make(text, parameters);
      }
      if (typeof parts === 'string') return make(quote(parts));
      const rows = Array.isArray(parts) ? parts : [parts];
      if (!rows.length) throw new Error('Empty SQL list.');
      if (typeof rows[0] !== 'object' || rows[0] === null) return make(`(${rows.map(() => '?').join(',')})`, rows);
      const columns = values.length ? values.flat() : Object.keys(rows[0]); const parameters = [];
      const tuples = rows.map((row) => `(${columns.map((column) => { const item = valuePart(row[column]); parameters.push(...item.values); return item.text; }).join(',')})`);
      return make(`(${columns.map(quote).join(',')}) VALUES ${tuples.join(',')}`, parameters);
    }
    sql.dialect = 'mysql';
    sql.json = (value) => { const encoded = JSON.stringify(value); if (encoded === undefined) throw new Error('Invalid JSON parameter.'); return make('?', [encoded]); };
    sql.unsafe = (text, values = []) => make(text, values);
    sql.begin = async (callback) => {
      if (connection) throw new Error('Use savepoint inside an existing transaction.');
      const acquired = await pool.getConnection();
      try {
        await ready(acquired); await acquired.beginTransaction();
        try { const result = await callback(tag(acquired)); await acquired.commit(); return result; }
        catch (error) { await acquired.rollback(); throw error; }
      } finally { acquired.release(); }
    };
    let savepoint = 0;
    sql.savepoint = async (callback) => {
      if (!connection) throw new Error('Savepoints require a transaction.');
      const name = `portal_sp_${++savepoint}`; await connection.query(`SAVEPOINT ${name}`);
      try { const result = await callback(sql); await connection.query(`RELEASE SAVEPOINT ${name}`); return result; }
      catch (error) { await connection.query(`ROLLBACK TO SAVEPOINT ${name}`); await connection.query(`RELEASE SAVEPOINT ${name}`); throw error; }
    };
    sql.end = () => pool.end();
    return sql;
  }
  return tag();
}
