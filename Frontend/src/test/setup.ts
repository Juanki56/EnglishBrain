import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// Con todas las pruebas en paralelo, la primera carga de una pantalla puede
// superar el segundo que Testing Library espera por defecto.
configure({ asyncUtilTimeout: 3000 });
