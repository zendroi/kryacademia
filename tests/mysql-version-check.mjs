import assert from 'node:assert/strict';
import { inspectMySQL } from '../lib/mysql-connection.mjs';

function connection(version, packetBytes = 4194304) {
  const queries = [];
  return { queries, query: async (query) => {
    queries.push(query);
    return [[{ version, product: version.includes('MariaDB') ? 'MariaDB Server' : 'MySQL Community Server', name: 'fixture', packetBytes }]];
  } };
}

for (const version of ['5.7.44', '8.0.20-log', '10.11.14-MariaDB-log', '11.8.8-MariaDB-log']) {
  const fixture = connection(version);
  await assert.rejects(inspectMySQL(fixture), /requires MySQL/);
  assert.equal(fixture.queries.length, 1, 'Reject unsupported versions before changing session settings');
}
await assert.rejects(inspectMySQL(connection('unknown')), /Unrecognized/);
await assert.rejects(inspectMySQL(connection('11.8.9-MariaDB-log', 1024)), /packet/);
for (const version of ['8.0.21-log', '8.4.9', '11.8.9-MariaDB-log']) {
  const fixture = connection(version);
  const result = await inspectMySQL(fixture);
  assert.equal(result.engine, version.includes('MariaDB') ? 'mariadb' : 'mysql');
  assert.equal(fixture.queries.some((query) => query.includes('group_concat_max_len')), result.engine === 'mariadb');
}
console.log('MySQL/MariaDB version suffixes, minimum versions, packet limit and session settings passed.');
