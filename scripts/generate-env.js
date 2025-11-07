const fs = require('fs');
const path = require('path');

// Read .env file
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

// Parse environment variables
const envVars = {};
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

console.log('✅ Environment files generated successfully from .env');
console.log(`   - ${devEnvPath}`);
console.log(`   - ${prodEnvPath}`);

