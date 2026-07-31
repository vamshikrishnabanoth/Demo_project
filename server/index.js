});
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`[DB Keep-Alive] Pinging every 9 minutes to prevent cold starts`);
    // SAFE: Only run auto-migration in development.
    // In production, migrations MUST be run via CI/CD pipeline using:
    //   npx prisma migrate deploy
    // NEVER use `prisma db push --accept-data-loss` in production — it can silently drop columns.
    if (process.env.NODE_ENV !== 'production') {
        setImmediate(() => {
            try {
                console.log('🔄 [Dev] Ensuring database schema is up-to-date...');
                exec('npx prisma migrate deploy', (error, stdout, stderr) => {
                    if (error) {
                        console.error('❌ [Dev] Failed to apply migrations:', error.message);
                        return;
                    }
                    console.log('✅ [Dev] Migration complete!');
                    if (stdout) console.log(`[Prisma Migrate]: ${stdout}`);
                    if (stderr) console.error(`[Prisma Migrate Err]: ${stderr}`);
                });
            } catch (err) {
                console.error('❌ [Dev] Failed to initiate migration:', err.message);
            }
        });
    } else {
        console.log('🟢 [Production] Skipping auto-migration. Run `npx prisma migrate deploy` in CI/CD.');
    }
});
