const fs = require('fs');
const path = require('path');

// Parse environment variables
const envVars = {};

// Check if .env file exists (local development)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  // Read from .env file (local development)
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        // Handle VITE_ prefix and convert to camelCase
        const cleanKey = key.replace(/^VITE_/, '').toLowerCase();
        const value = valueParts.join('=').trim();
        
        if (cleanKey === 'supabase_url') {
          envVars.supabaseUrl = value;
        } else if (cleanKey === 'supabase_anon_key') {
          envVars.supabaseAnonKey = value;
        }
      }
    }
  });
  console.log('📄 Reading environment variables from .env file');
} else {
  // Read from process.env (Vercel/CI environments)
  // Try multiple possible variable names
  envVars.supabaseUrl = 
    process.env.VITE_SUPABASE_URL || 
    process.env.SUPABASE_URL || 
    '';
  
  envVars.supabaseAnonKey = 
    process.env.VITE_SUPABASE_ANON_KEY || 
    process.env.SUPABASE_ANON_KEY || 
    '';
  
  console.log('🌐 Reading environment variables from process.env (Vercel/CI)');
}

// Generate environment.ts content
const devEnvContent = `// This file can be replaced during build by using the \`fileReplacements\` array.
// \`ng build\` replaces \`environment.ts\` with \`environment.prod.ts\`.
// The list of file replacements can be found in \`angular.json\`.

export const environment = {
  production: false,
  supabaseUrl: '${envVars.supabaseUrl || ''}',
  supabaseAnonKey: '${envVars.supabaseAnonKey || ''}',
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as \`zone.run\`, \`zoneDelegate.invokeTask\`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
`;

// Generate environment.prod.ts content
const prodEnvContent = `export const environment = {
  production: true,
  supabaseUrl: '${envVars.supabaseUrl || ''}',
  supabaseAnonKey: '${envVars.supabaseAnonKey || ''}',
};
`;

// Write files
const devEnvPath = path.join(__dirname, '..', 'src', 'environments', 'environment.ts');
const prodEnvPath = path.join(__dirname, '..', 'src', 'environments', 'environment.prod.ts');

fs.writeFileSync(devEnvPath, devEnvContent);
fs.writeFileSync(prodEnvPath, prodEnvContent);

console.log('✅ Environment files generated successfully');
console.log(`   - ${devEnvPath}`);
console.log(`   - ${prodEnvPath}`);

