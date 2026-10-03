import { getDatabase } from './database.ts';
import { CREATE_TABLES_SQL } from './schema.ts';
import { hashPassword } from '../server/utils/password.ts';
import { DatabaseSync } from 'node:sqlite';

export function seed(customDb?: DatabaseSync) {
  const db = customDb || getDatabase();
  db.exec(`
    DROP TABLE IF EXISTS activity_log;
    DROP TABLE IF EXISTS work_items;
    DROP TABLE IF EXISTS requests;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS workspaces;
  `);
  db.exec(CREATE_TABLES_SQL);

  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();
  const daysFromNow = (days: number) => new Date(now.getTime() + days * 86400000).toISOString().split('T')[0];
  const passwordHash = hashPassword('password123');

  const insertWorkspace = db.prepare('INSERT INTO workspaces (id, name, industry, created_at) VALUES (?, ?, ?, ?)');
  insertWorkspace.run('ws_apex', 'Apex Mechanical & HVAC', 'Commercial & Industrial Climate Systems', daysAgo(30));
  insertWorkspace.run('ws_beacon', 'Beacon Commercial Plumbing', 'Municipal & Commercial Fluid Systems', daysAgo(30));

  const insertUser = db.prepare(`
    INSERT INTO users (id, name, user_type, email, password, workspace_id, phone)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const users = [
    ['user_marcus', 'Marcus Vance', 'WORKPLACE', 'marcus@apexhvac.example.com', 'ws_apex', '(555) 349-1000'],
    ['user_elena', 'Elena Rostova', 'WORKPLACE', 'elena@beaconplumbing.example.com', 'ws_beacon', '(555) 819-2000'],
    ['user_cust_robert', 'Robert Sterling', 'CUSTOMER', 'rsterling@harborbaycondos.example.com', null, '(555) 819-2041'],
    ['user_cust_arthur', 'Dr. Arthur Pendelton', 'CUSTOMER', 'arthur.p@metrohealth.example.com', null, '(555) 349-8812'],
    ['user_cust_claire', 'Claire Beaumont', 'CUSTOMER', 'cbeaumont@grandplazaretail.example.com', null, '(555) 782-9014'],
    ['user_cust_david', 'David Lin', 'CUSTOMER', 'dlin@summittechpark.example.com', null, '(555) 912-3401'],
    ['user_cust_sandra', 'Sandra Miller', 'CUSTOMER', 'smiller@westwarehousing.example.com', null, '(555) 431-7789'],
    ['user_cust_fiona', 'Fiona Gallagher', 'CUSTOMER', 'fiona@pacificbrewery.example.com', null, '(555) 674-1190'],
    ['user_cust_gregory', 'Gregory Vance', 'CUSTOMER', 'gvance@civiccenter.example.gov', null, '(555) 230-9844'],
    ['user_cust_thomas', 'Thomas Sterling', 'CUSTOMER', 'tsterling@bellviewdiner.example.com', null, '(555) 441-9022']
  ];
  for (const [id, name, userType, email, workspaceId, phone] of users) {
    insertUser.run(id, name, userType, email, passwordHash, workspaceId, phone);
  }

  const insertRequest = db.prepare(`
    INSERT INTO requests (id, workspace_id, customer_id, description, service_title, status, preferred_date, work_item_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const requests = [
    [10000, 'ws_apex', 'user_cust_robert', 'High-rise residential tower experiencing water pressure drops between 18:00 and 20:00 on floors 14-22. Variable frequency drive tripping on low suction pressure fault.', 'Main Water Booster Pump Cavitation Diagnostic', 'NEW', daysFromNow(2), null, daysAgo(1)],
    [10001, 'ws_beacon', 'user_cust_arthur', 'Building B rooftop chiller unit #3 threw high-vibration harmonic warning code E-44 during peak cooling hours. Requesting acoustic vibration analysis and bearing diagnostic before thermal shutdown.', 'Rooftop Chiller Vibration & Harmonic Alarm', 'NEW', daysFromNow(3), null, daysAgo(1)],
    [10002, 'ws_beacon', 'user_cust_claire', 'Scheduled semi-annual HVAC maintenance across 6 rooftop units. Includes Merv-13 filter replacement, condenser coil chemical wash, economizer actuator calibration, and airflow balance verification.', 'Bi-Annual Filter, Coil & Economizer Service', 'QUALIFIED', daysFromNow(5), null, daysAgo(2)],
    [10003, 'ws_beacon', 'user_cust_david', 'Data Center Pod 4 dual Liebert CRAC units showing refrigerant leak on loop A and variable fan speed controller oscillation. Urgent remediation needed prior to server density upgrade.', 'Mission-Critical Server Room CRAC Overhaul', 'QUALIFIED', daysFromNow(1), null, daysAgo(3)],
    [10004, 'ws_beacon', 'user_cust_sandra', 'Inquiry for full sanitization and fogging of high-bay distribution warehouse ducting.', 'Distribution Center Duct Sanitization', 'CLOSED', null, null, daysAgo(7)],
    [10005, 'ws_beacon', 'user_cust_fiona', 'Mandatory annual city testing for four 4-inch reduced pressure zone backflow preventers feeding commercial brewing kettles and steam boiler blowdown circuits.', 'Annual Backflow Assembly Testing & Steam Boiler Certification', 'QUALIFIED', daysFromNow(4), null, daysAgo(2)],
    [10006, 'ws_beacon', 'user_cust_gregory', 'East retention basin motorized sluice gate jammed in 40% open position ahead of predicted atmospheric river system. Immediate hydraulic winch override and gearbox replacement required.', 'Municipal Stormwater Retention Gate Actuator Failure', 'QUALIFIED', daysFromNow(1), null, daysAgo(4)],
    [10007, 'ws_beacon', 'user_cust_thomas', 'Quarterly maintenance cleaning of 750-gallon commercial exterior grease trap vault.', 'Grease Interceptor Jetting & Hydro-Scrub', 'CLOSED', null, null, daysAgo(10)]
  ];
  for (const request of requests) insertRequest.run(...request);

  const insertWorkItem = db.prepare(`
    INSERT INTO work_items (work_item_id, request_id, scheduled_date, assigned_technician, description, status, created_by_user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertWorkItem.run(100000, 10003, daysFromNow(1), 'Alex Mercer (Senior Thermal Tech)', 'Customer provided 24/7 security badge access and nitrogen leak-detector clearance.', 'SCHEDULED', 'user_elena', daysAgo(2));
  insertWorkItem.run(100001, 10006, daysFromNow(1), 'Samira Khan (Heavy Civil Tech)', 'City permit issued for lane closure on North Canal Way.', 'SCHEDULED', 'user_elena', daysAgo(3));
  db.prepare('UPDATE requests SET work_item_id = ? WHERE id = ?').run(100000, 10003);
  db.prepare('UPDATE requests SET work_item_id = ? WHERE id = ?').run(100001, 10006);

  const insertActivity = db.prepare(`
    INSERT INTO activity_log (id, workspace_id, request_id, actor_id, action, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const request of requests) {
    insertActivity.run(`act_request_${request[0]}`, request[1], request[0], request[2], 'REQUEST_CREATED', JSON.stringify({ note: 'Customer service request submitted.' }), request[8]);
  }
  for (const [requestId, status] of [[10002, 'QUALIFIED'], [10003, 'QUALIFIED'], [10004, 'CLOSED'], [10005, 'QUALIFIED'], [10006, 'QUALIFIED'], [10007, 'CLOSED']] as const) {
    insertActivity.run(`act_status_${requestId}`, 'ws_beacon', requestId, 'user_elena', 'STATUS_CHANGED', JSON.stringify({ oldStatus: 'NEW', newStatus: status }), daysAgo(1));
  }
  insertActivity.run('act_convert_10003', 'ws_beacon', 10003, 'user_elena', 'CONVERTED_TO_WORK_ITEM', JSON.stringify({ workItemId: 100000, scheduledDate: daysFromNow(1), assignedTechnician: 'Alex Mercer (Senior Thermal Tech)' }), daysAgo(2));
  insertActivity.run('act_convert_10006', 'ws_beacon', 10006, 'user_elena', 'CONVERTED_TO_WORK_ITEM', JSON.stringify({ workItemId: 100001, scheduledDate: daysFromNow(1), assignedTechnician: 'Samira Khan (Heavy Civil Tech)' }), daysAgo(3));

  console.log('Database seeded successfully: 2 workspaces, 10 users, 8 requests, 2 work items, and 16 activity logs.');
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) seed();
