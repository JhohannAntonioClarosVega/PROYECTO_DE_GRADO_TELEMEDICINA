export const hasClinicalRecordFields = (diagnosis: string, treatment: string) => !!diagnosis.trim() && !!treatment.trim();

export function generatePrescriptionHtml({ patientName, doctorName, diagnosis, treatment, pharmacyName }: { patientName: string; doctorName: string; diagnosis: string; treatment: string; pharmacyName: string }) {
    const currentDate = new Date().toLocaleDateString('es-BO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receta Médica Digital</title>
        <style>
          body { font-family: 'Arial', sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
          .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
          .header h1 { margin: 0; color: #0f172a; font-size: 22px; text-transform: uppercase; }
          .header h2 { margin: 4px 0 0; color: #2563eb; font-size: 15px; }
          .header p { margin: 4px 0 0; color: #64748b; font-size: 12px; }
          .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          .meta-table td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
          .meta-label { font-weight: bold; color: #475569; width: 30%; }
          .section { margin-bottom: 20px; background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #2563eb; }
          .section-title { font-size: 13px; font-weight: bold; color: #2563eb; text-transform: uppercase; margin-bottom: 8px; }
          .section-content { font-size: 14px; color: #0f172a; white-space: pre-wrap; }
          .pharmacy-box { background: #ecfdf5; border: 1px solid #a7f3d0; padding: 14px; border-radius: 8px; margin-top: 16px; }
          .pharmacy-title { font-weight: bold; color: #065f46; font-size: 12px; text-transform: uppercase; }
          .pharmacy-name { color: #047857; font-size: 14px; margin-top: 4px; font-weight: bold; }
          .footer { margin-top: 50px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 24px; }
          .signature-line { width: 200px; border-top: 1px solid #0f172a; margin: 0 auto 8px; }
          .signature-title { font-size: 13px; font-weight: bold; color: #0f172a; }
          .signature-sub { font-size: 11px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Gobierno Autónomo Municipal de Cochabamba</h1>
          <h2>Sistema de Telemedicina IA & Red Salud UNIVALLE</h2>
          <p>Receta Médica y Prescripción Digital</p>
        </div>

        <table class="meta-table">
          <tr>
            <td class="meta-label">Paciente:</td>
            <td><strong>${patientName}</strong></td>
          </tr>
          <tr>
            <td class="meta-label">Médico Tratante:</td>
            <td><strong>${doctorName}</strong></td>
          </tr>
          <tr>
            <td class="meta-label">Fecha de Emisión:</td>
            <td>${currentDate}</td>
          </tr>
        </table>

        <div class="section">
          <div class="section-title">Diagnóstico Clínico</div>
          <div class="section-content">${diagnosis}</div>
        </div>

        <div class="section" style="border-left-color: #10b981;">
          <div class="section-title" style="color: #10b981;">Plan de Tratamiento y Receta</div>
          <div class="section-content">${treatment}</div>
        </div>

        ${pharmacyName ? `
          <div class="pharmacy-box">
            <div class="pharmacy-title">Farmacia Aliada Sugerida</div>
            <div class="pharmacy-name">${pharmacyName}</div>
          </div>
        ` : ''}

        <div class="footer">
          <div class="signature-line"></div>
          <div class="signature-title">${doctorName}</div>
          <div class="signature-sub">Firma y Registro Médico Digital</div>
          <p style="font-size: 10px; color: #94a3b8; margin-top: 16px;">Documento oficial expedido electrónicamente por el G.A.M. Cochabamba.</p>
        </div>
      </body>
      </html>
    `;
  };
