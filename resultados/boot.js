import { requireAuthenticatedRoute } from '../js/core/route-guard.js';
const context = await requireAuthenticatedRoute('../app/login.html');
if (context) await import('./results-app-v3.js');
