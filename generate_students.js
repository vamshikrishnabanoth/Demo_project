const fs = require('fs');
const path = require('path');

const RAW_FILE = 'students_raw.txt';
const OUTPUT_FILE = 'manual_upload_students.json';
const PASSWORD_HASH = '$2b$10$OLWad72wOXEoBb5NtHw/S.s217LTY6ARlz3gVsTrXez1t3QOil7oq'; // Hash for 'kmit'

try {
    const data = fs.readFileSync(path.join(__dirname, RAW_FILE), 'utf8');
    const lines = data.split('\n').filter(line => line.trim() !== '');

    const students = lines.map(line => {
        const parts = line.split(/\t| {2,}/).filter(p => p.trim() !== '');
        if (parts.length < 3) return null;

        const rollNo = parts[0].trim();
        const section = parts[1].trim();
        const name = parts[2].trim();

        return {
            username: rollNo,
            email: rollNo,
            password: PASSWORD_HASH,
            role: 'student',
            name: name,
            section: section, // Adding section just in case
            createdAt: {
                "$date": new Date().toISOString()
            }
        };
    }).filter(s => s !== null);

    fs.writeFileSync(path.join(__dirname, OUTPUT_FILE), JSON.stringify(students, null, 2));
    console.log(`Successfully generated ${students.length} students in ${OUTPUT_FILE}`);
} catch (err) {
    console.error('Error:', err.message);
}
