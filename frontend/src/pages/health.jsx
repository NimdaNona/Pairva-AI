import React from 'react';

// Simple health check endpoint that returns 200 OK
// This is used by the container health check
export default function Health() {
  // Return plain text for lightweight response
  return (
    <div style={{ fontFamily: 'monospace', padding: '20px' }}>
      OK
    </div>
  );
}

// This ensures proper Content-Type and status code
export async function getServerSideProps({ res }) {
  res.setHeader('Content-Type', 'text/plain; charset=ascii');
  res.statusCode = 200;

  return {
    props: {},
  };
}
