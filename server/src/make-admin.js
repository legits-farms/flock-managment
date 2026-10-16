// Makes an account an admin, found by its phone number. An admin is made by hand,
// never from the app. Run with `npm run make:admin -- <phone>` to see the account,
// then add `--apply` to make it an admin.
import prisma, { disconnectDb } from './db.js';

const phone = (process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? '').replace(/\D/g, '');
const apply = process.argv.includes('--apply');

const user = phone ? await prisma.user.findUnique({ where: { phone } }) : null;
if (!user) {
  console.log(phone ? `No account with phone ${phone}.` : 'Give the phone number: npm run make:admin -- <phone>');
} else {
  console.log(`${user.name} · ${user.phone} · role ${user.role} · ${user.status}`);
  if (user.role === 'admin' && user.status === 'approved') {
    console.log('Already an admin.');
  } else if (!apply) {
    console.log('Nothing changed. Run again with --apply to make this account an admin.');
  } else {
    // An admin works on every farm, so a manager's farm goes
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'admin', status: 'approved', farm: null },
    });
    console.log(`${user.name} is now an admin.`);
  }
}
await disconnectDb();
