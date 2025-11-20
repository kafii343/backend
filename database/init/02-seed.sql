-- SEED DATABASE WITH INITIAL DATA

-- INSERT INITIAL ADMIN USER
-- To generate bcrypt hash for 'admin123': bcrypt.hash('admin123', 10)
-- Example hash: $2b$10$vDtCx6m81fJScNYomqIGgeTFz2d3aNb2xmVmFHkT7J6acmGr9GofW (hash for 'admin123')
-- Insert initial admin user
INSERT INTO users (username, email, password, role, created_at) 
VALUES ('admin', 'admin@cartenz.com', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36DRcT3e', 'admin', NOW());

-- INSERT TRIP DATA (only if tables exist)
INSERT INTO open_trips VALUES 
(1, 'Sunrise Bawakaraeng 4D3N', 1, 4, 3, 'Sulit', 750000, 950000, 8, 12, 'test', '/bawakaraeng.jpg', ARRAY['Guide'], ARRAY['Sunrise']);

-- VERIFY DATA
SELECT * FROM users WHERE role='admin';
SELECT * FROM open_trips;

-- EXIT
\q