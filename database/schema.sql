CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'loan_officer', 'client')),
    phone VARCHAR(20),
    purpose VARCHAR(255),
    id_number TEXT,
    address TEXT,
    id_photo_back TEXT,
    id_photo_front TEXT,
    reset_password_otp VARCHAR(6),
    reset_password_expires TIMESTAMP,
    passport_photo TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    id_number VARCHAR(100) UNIQUE NOT NULL,
    address TEXT NOT NULL,
    guarantor_name VARCHAR(255) NOT NULL,
    guarantor_phone VARCHAR(20) NOT NULL,
    guarantor_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loans (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    client_name VARCHAR(255) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    interest_rate DECIMAL(5,2) NOT NULL,
    term INTEGER NOT NULL,
    term_unit VARCHAR(10) NOT NULL CHECK (term_unit IN ('days','weeks','months')),
    installment_frequency VARCHAR(10) NOT NULL CHECK (installment_frequency IN ('days','weeks','months')),
    penalty_rate DECIMAL(5,2) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending','approved','rejected','active','paid','overdue')),
    installment_amount DECIMAL(15,2),
    remaining_balance DECIMAL(15,2) NOT NULL,
    total_paid DECIMAL(15,2) DEFAULT 0,
    penalties DECIMAL(15,2) DEFAULT 0,
    due_date DATE NOT NULL,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER NOT NULL REFERENCES loans(id),
    client_id INTEGER NOT NULL REFERENCES clients(id),
    amount DECIMAL(15,2) NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    method VARCHAR(50) NOT NULL CHECK (method IN ('mpesa', 'cash', 'bank')),
    reference VARCHAR(255) NOT NULL,
    mpesa_code VARCHAR(255) UNIQUE,
    status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS penalties (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER NOT NULL REFERENCES loans(id),
    client_id INTEGER NOT NULL REFERENCES clients(id),
    amount DECIMAL(15,2) NOT NULL,
    reason TEXT NOT NULL,
    applied_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'waived', 'paid')),
    waived_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('info', 'warning', 'success', 'error', 'payment', 'loan', 'system')),
    read BOOLEAN DEFAULT FALSE,
    priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    related_entity VARCHAR(255),
    related_entity_type VARCHAR(50) CHECK (related_entity_type IN ('loan', 'payment', 'client', 'penalty')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN purpose VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_loans_client_id ON loans(client_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_payments_loan_id ON payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_penalties_loan_id ON penalties(loan_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);