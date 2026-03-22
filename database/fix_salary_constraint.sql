ALTER TABLE salary_records ADD CONSTRAINT unique_salary_record UNIQUE (emp_id, month, year);
