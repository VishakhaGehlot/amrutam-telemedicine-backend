# Amrutam Telemedicine Backend

A backend project developed as part of a backend assignment using Node.js, Express.js, and PostgreSQL. It implements core telemedicine workflows through REST APIs.

## Features

- User registration and login using JWT authentication
- Patient, doctor, and admin roles
- Doctor search and availability management
- Consultation booking and status management
- Prescription management
- Admin analytics and doctor verification
- Input validation and security middleware
- Health check endpoints

## Tech Stack

- Node.js
- Express.js
- PostgreSQL
- JWT
- Zod
- Docker

## Getting Started

**Prerequisites:** Node.js 20+, npm, and PostgreSQL 16 or Docker.

1. Clone the repository:

   ```bash
   git clone https://github.com/VishakhaGehlot/amrutam-telemedicine-backend.git
   cd amrutam-telemedicine-backend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure the `.env` file using `.env.example` and set your database connection and JWT secret.

4. Run database setup:

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. Start the server:

   ```bash
   npm run dev
   ```

6. Run tests:

   ```bash
   npm test
   ```

## API Documentation

See [`openapi.yaml`](./openapi.yaml) for the API specification.

## Limitations

- No payment gateway integration
- No real-time video consultation integration
- Additional testing and security improvements are needed before production use

## Project Status

This project is an assignment/reference implementation for learning and demonstrating backend development concepts. It is not a production-ready healthcare platform.
