# JavaScript API Template

A modern, lightweight Express.js boilerplate for building REST APIs.

## Features

- **Express.js**: Fast, unopinionated, minimalist web framework.
- **CORS**: Cross-Origin Resource Sharing enabled.
- **Dotenv**: Environment variable management.
- **Global Error Handling**: Catch and handle errors gracefully.
- **404 Handling**: Custom 404 response for unknown routes.

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher recommended)
- [npm](https://www.npmjs.com/)

## Getting Started

1.  **Clone the template** (or copy the files).
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Setup environment**:
    ```bash
    cp .env.example .env
    ```
4.  **Run the server**:
    - Development mode (with nodemon):
      ```bash
      npm run dev
      ```
    - Production mode:
      ```bash
      npm start
      ```

## API Endpoints

- `GET /`: Welcome message.
- `GET /api/health`: Health check with timestamp.
- `GET /api/resource`: Sample resource data.

## License

ISC
