// Gerador de payload PIX BR Code
// Baseado na especificação do Banco Central do Brasil

interface PixPayload {
  chavePix: string;
  nomeBeneficiario: string;
  cidadeBeneficiario: string;
  valor?: number;
  txid?: string;
  descricao?: string;
}

// Calcula CRC16 CCITT-FALSE
function crc16(str: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  crc &= 0xFFFF;
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Formata um campo EMV com ID + tamanho + valor
function formatField(id: string, value: string): string {
  const length = value.length.toString().padStart(2, '0');
  return `${id}${length}${value}`;
}

// Remove caracteres especiais e acentos
function sanitizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-zA-Z0-9 ]/g, '') // Remove caracteres especiais
    .substring(0, 25) // Limite de 25 caracteres
    .toUpperCase();
}

// Gera o payload PIX completo
export function generatePixPayload(data: PixPayload): string {
  // Validações
  if (!data.chavePix || !data.nomeBeneficiario || !data.cidadeBeneficiario) {
    throw new Error('Chave PIX, nome e cidade do beneficiário são obrigatórios');
  }

  // 00 - Payload Format Indicator
  let payload = formatField('00', '01');
  
  // 01 - Point of Initiation Method (12 = valor único/dinâmico)
  if (data.valor && data.valor > 0) {
    payload += formatField('01', '12');
  }
  
  // 26 - Merchant Account Information (PIX)
  const gui = formatField('00', 'br.gov.bcb.pix'); // GUI do PIX
  const chave = formatField('01', data.chavePix);
  let merchantInfo = gui + chave;
  
  // Adicionar descrição se informada (campo 02)
  if (data.descricao) {
    const desc = sanitizeText(data.descricao);
    if (desc) {
      merchantInfo += formatField('02', desc);
    }
  }
  
  payload += formatField('26', merchantInfo);
  
  // 52 - Merchant Category Code (0000 = não especificado)
  payload += formatField('52', '0000');
  
  // 53 - Transaction Currency (986 = BRL)
  payload += formatField('53', '986');
  
  // 54 - Transaction Amount (se informado)
  if (data.valor && data.valor > 0) {
    const valorStr = data.valor.toFixed(2);
    payload += formatField('54', valorStr);
  }
  
  // 58 - Country Code
  payload += formatField('58', 'BR');
  
  // 59 - Merchant Name
  payload += formatField('59', sanitizeText(data.nomeBeneficiario));
  
  // 60 - Merchant City
  payload += formatField('60', sanitizeText(data.cidadeBeneficiario));
  
  // 62 - Additional Data Field Template (txid)
  if (data.txid) {
    const txidField = formatField('05', data.txid.substring(0, 25));
    payload += formatField('62', txidField);
  }
  
  // 63 - CRC16 (adiciona o campo vazio para calcular)
  payload += '6304';
  const crc = crc16(payload);
  payload += crc;
  
  return payload;
}

// Tipo do fluxo para TxID
export type TipoFluxoTxId = 'PARCELAMENTO' | 'REFORCO';

// Gera um txid baseado nos dados do lote no formato AESAPIX
// Exemplo: "AESAPIXQBL01P01" para Quadra B, Lote 01, Parcela 01
// Exemplo: "AESAPIXQAL03R02" para Quadra A, Lote 03, 2º Reforço
export function generateTxId(
  quadra: string, 
  lote: string, 
  numero: number, 
  tipoFluxo: TipoFluxoTxId = 'PARCELAMENTO'
): string {
  // Prefixo constante AESAPIX
  const prefixoConstante = 'AESAPIX';
  // Formatar quadra: manter letras e números (ex: "A" -> "A", "01" -> "01")
  const q = quadra.trim().toUpperCase();
  // Formatar lote com 2 dígitos
  const l = lote.replace(/\D/g, '').padStart(2, '0');
  // Prefixo P para Parcelamento, R para Reforço
  const prefixoTipo = tipoFluxo === 'REFORCO' ? 'R' : 'P';
  // Número com 2 dígitos
  const n = numero.toString().padStart(2, '0');
  
  return `${prefixoConstante}Q${q}L${l}${prefixoTipo}${n}`;
}
