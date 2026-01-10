import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Lote = Database['public']['Tables']['lotes']['Row'];
type ContaCorrenteInsert = Database['public']['Tables']['conta_corrente_lote']['Insert'];

interface CSVRow {
  data: string;
  historico: string;
  referencia: string;
  vencimento: string;
  calculos: string;
  debitos: string;
  creditos: string;
  saldo: string;
  naturezaSaldo: string;
}

interface ParsedRow {
  data_mov: string;
  descricao: string;
  referencia: string;
  vencimento: string | null;
  percentual_calculo: number | null;
  debito: number;
  credito: number;
  saldo: number;
  tipo_mov: string;
  lineNumber: number;
  rawData: CSVRow;
}

interface ImportResult {
  success: boolean;
  lineNumber: number;
  error?: string;
}

// Parse Brazilian date DD/MM/YYYY to ISO YYYY-MM-DD
function parseBrazilianDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  if (!day || !month || !year) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Parse Brazilian number format XX.XXX,XX to float
function parseBrazilianNumber(numStr: string): number {
  if (!numStr || numStr.trim() === '') return 0;
  // Remove thousands separator (.) and replace decimal comma with period
  const cleaned = numStr.trim().replace(/\./g, '').replace(',', '.');
  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : value;
}

// Determine tipo_mov based on historico text
function determineTipoMov(historico: string): string {
  const h = historico.toUpperCase();
  if (h.includes('VENDA') || h.includes('CONTRATO')) return 'VENDA';
  if (h.includes('ARRAS') || h.includes('SINAL')) return 'ARRAS';
  if (h.includes('PARCELA')) return 'PARCELA';
  if (h.includes('REFORÇO') || h.includes('REFORCO')) return 'REFORCO';
  if (h.includes('JUROS')) return 'JUROS';
  if (h.includes('MULTA')) return 'MULTA';
  if (h.includes('ATUALIZAÇÃO') || h.includes('ATUALIZACAO') || h.includes('CORREÇÃO') || h.includes('CORRECAO')) return 'ATUALIZACAO';
  if (h.includes('DESCONTO')) return 'DESCONTO';
  if (h.includes('ESTORNO')) return 'ESTORNO';
  return 'OUTROS';
}

export default function Importacao() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedLoteId, setSelectedLoteId] = useState<string>('');
  const [selectedVendaId, setSelectedVendaId] = useState<string>('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);

  // Fetch lotes
  const { data: lotes = [] } = useQuery({
    queryKey: ['lotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lotes')
        .select('*')
        .order('quadra', { ascending: true })
        .order('numero_lote', { ascending: true });
      if (error) throw error;
      return data as Lote[];
    }
  });

  // Fetch vendas for selected lote
  const { data: vendas = [] } = useQuery({
    queryKey: ['vendas', selectedLoteId],
    queryFn: async () => {
      if (!selectedLoteId) return [];
      const { data, error } = await supabase
        .from('vendas')
        .select('id, data_venda, valor_venda, status')
        .eq('lote_id', selectedLoteId)
        .order('data_venda', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedLoteId
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setCsvFile(file);
    setParsedData([]);
    setParseError(null);
    setImportResults([]);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        
        if (lines.length < 2) {
          setParseError('Arquivo CSV deve ter pelo menos uma linha de cabeçalho e uma linha de dados.');
          return;
        }

        // Skip header line
        const dataLines = lines.slice(1);
        const parsed: ParsedRow[] = [];

        for (let i = 0; i < dataLines.length; i++) {
          const line = dataLines[i];
          const columns = line.split(';');
          
          if (columns.length < 9) {
            setParseError(`Linha ${i + 2}: número insuficiente de colunas (esperado 9, encontrado ${columns.length}).`);
            return;
          }

          const csvRow: CSVRow = {
            data: columns[0] || '',
            historico: columns[1] || '',
            referencia: columns[2] || '',
            vencimento: columns[3] || '',
            calculos: columns[4] || '',
            debitos: columns[5] || '',
            creditos: columns[6] || '',
            saldo: columns[7] || '',
            naturezaSaldo: columns[8] || ''
          };

          const dataMov = parseBrazilianDate(csvRow.data);
          if (!dataMov) {
            setParseError(`Linha ${i + 2}: data inválida "${csvRow.data}". Use formato DD/MM/YYYY.`);
            return;
          }

          parsed.push({
            data_mov: dataMov,
            descricao: csvRow.historico.trim(),
            referencia: csvRow.referencia.trim(),
            vencimento: parseBrazilianDate(csvRow.vencimento),
            percentual_calculo: csvRow.calculos ? parseBrazilianNumber(csvRow.calculos) : null,
            debito: parseBrazilianNumber(csvRow.debitos),
            credito: parseBrazilianNumber(csvRow.creditos),
            saldo: parseBrazilianNumber(csvRow.saldo),
            tipo_mov: determineTipoMov(csvRow.historico),
            lineNumber: i + 2,
            rawData: csvRow
          });
        }

        setParsedData(parsed);
        toast.success(`${parsed.length} registros lidos do arquivo.`);
      } catch (err) {
        setParseError(`Erro ao processar arquivo: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    if (!selectedLoteId) {
      toast.error('Selecione um lote para importação.');
      return;
    }
    if (parsedData.length === 0) {
      toast.error('Nenhum dado para importar.');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    const results: ImportResult[] = [];

    try {
      for (let i = 0; i < parsedData.length; i++) {
        const row = parsedData[i];
        
        const insertData: ContaCorrenteInsert = {
          lote_id: selectedLoteId,
          venda_id: selectedVendaId || null,
          data_mov: row.data_mov,
          tipo_mov: row.tipo_mov,
          descricao: row.descricao,
          referencia: row.referencia || null,
          vencimento: row.vencimento,
          percentual_calculo: row.percentual_calculo,
          debito: row.debito,
          credito: row.credito,
          saldo: row.saldo
        };

        const { error } = await supabase
          .from('conta_corrente_lote')
          .insert(insertData);

        if (error) {
          results.push({ success: false, lineNumber: row.lineNumber, error: error.message });
        } else {
          results.push({ success: true, lineNumber: row.lineNumber });
        }

        setImportProgress(Math.round(((i + 1) / parsedData.length) * 100));
      }

      setImportResults(results);
      
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      if (errorCount === 0) {
        toast.success(`Importação concluída! ${successCount} registros importados com sucesso.`);
      } else {
        toast.warning(`Importação concluída com erros. ${successCount} sucesso, ${errorCount} erros.`);
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['conta-corrente'] });
      queryClient.invalidateQueries({ queryKey: ['resumo-operacoes'] });

    } catch (err) {
      toast.error(`Erro durante importação: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setCsvFile(null);
    setParsedData([]);
    setParseError(null);
    setImportResults([]);
    setImportProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const selectedLote = lotes.find(l => l.id === selectedLoteId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Importação de Operações (CSV)</h1>
        <p className="text-muted-foreground">Importe histórico de operações via arquivo CSV</p>
      </div>

      {/* Instruções */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Layout do Arquivo CSV
          </CardTitle>
          <CardDescription>
            O arquivo deve usar ";" como separador de campos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-2">
            <p className="font-medium">Colunas esperadas (na ordem):</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li><strong>Data</strong> - formato DD/MM/YYYY</li>
              <li><strong>Historico</strong> - descrição da operação</li>
              <li><strong>Referencia</strong> - referência adicional</li>
              <li><strong>Vencimento</strong> - formato DD/MM/YYYY</li>
              <li><strong>Calculos</strong> - percentual (formato XX,XXXX)</li>
              <li><strong>Debitos</strong> - valor faturado (formato XX.XXX,XX)</li>
              <li><strong>Creditos</strong> - valor recebido (formato XX.XXX,XX)</li>
              <li><strong>Saldo</strong> - saldo atual (formato XX.XXX,XX)</li>
              <li><strong>Natureza Saldo</strong> - D ou C</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Seleção de Lote e Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Parâmetros de Importação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lote">Lote de Destino *</Label>
              <Select value={selectedLoteId} onValueChange={(value) => {
                setSelectedLoteId(value);
                setSelectedVendaId('');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o lote" />
                </SelectTrigger>
                <SelectContent>
                  {lotes.map((lote) => (
                    <SelectItem key={lote.id} value={lote.id}>
                      Quadra {lote.quadra} - Lote {lote.numero_lote} ({lote.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="venda">Venda (opcional)</Label>
              <Select 
                value={selectedVendaId} 
                onValueChange={(val) => setSelectedVendaId(val === '__none__' ? '' : val)} 
                disabled={!selectedLoteId || vendas.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={vendas.length === 0 ? "Nenhuma venda" : "Selecione a venda"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhuma</SelectItem>
                  {vendas.map((venda) => (
                    <SelectItem key={venda.id} value={venda.id}>
                      {new Date(venda.data_venda).toLocaleDateString('pt-BR')} - {formatCurrency(venda.valor_venda)} ({venda.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="csvFile">Arquivo CSV</Label>
            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                id="csvFile"
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                disabled={isImporting}
              />
              {csvFile && (
                <Button variant="outline" onClick={handleReset} disabled={isImporting}>
                  Limpar
                </Button>
              )}
            </div>
          </div>

          {selectedLote && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Lote Selecionado</AlertTitle>
              <AlertDescription>
                Quadra {selectedLote.quadra} - Lote {selectedLote.numero_lote}
                {selectedLote.matricula_ri && ` | Matrícula: ${selectedLote.matricula_ri}`}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Erros de Parse */}
      {parseError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao ler arquivo</AlertTitle>
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}

      {/* Preview dos Dados */}
      {parsedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Preview dos Dados ({parsedData.length} registros)</span>
              <Button 
                onClick={handleImport} 
                disabled={isImporting || !selectedLoteId}
                className="bg-primary"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Importar Dados
                  </>
                )}
              </Button>
            </CardTitle>
            {isImporting && (
              <Progress value={importProgress} className="mt-2" />
            )}
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Histórico</TableHead>
                    <TableHead>Referência</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">Débito</TableHead>
                    <TableHead className="text-right">Crédito</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    {importResults.length > 0 && <TableHead>Status</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 100).map((row, idx) => {
                    const result = importResults.find(r => r.lineNumber === row.lineNumber);
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-xs">{row.lineNumber}</TableCell>
                        <TableCell>{new Date(row.data_mov).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>
                          <span className="text-xs px-2 py-1 rounded bg-muted">
                            {row.tipo_mov}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{row.descricao}</TableCell>
                        <TableCell>{row.referencia}</TableCell>
                        <TableCell>
                          {row.vencimento ? new Date(row.vencimento).toLocaleDateString('pt-BR') : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {row.percentual_calculo?.toFixed(4) || '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-destructive">
                          {row.debito > 0 ? formatCurrency(row.debito) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-green-600">
                          {row.credito > 0 ? formatCurrency(row.credito) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrency(row.saldo)}
                        </TableCell>
                        {importResults.length > 0 && (
                          <TableCell>
                            {result?.success ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : result?.error ? (
                              <span className="text-xs text-destructive" title={result.error}>
                                <AlertCircle className="h-4 w-4" />
                              </span>
                            ) : null}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {parsedData.length > 100 && (
              <p className="text-sm text-muted-foreground mt-2">
                Mostrando os primeiros 100 registros de {parsedData.length} total.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Resultado da Importação */}
      {importResults.length > 0 && !isImporting && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado da Importação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium">
                  {importResults.filter(r => r.success).length} sucesso
                </span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <span className="font-medium">
                  {importResults.filter(r => !r.success).length} erros
                </span>
              </div>
            </div>
            
            {importResults.filter(r => !r.success).length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium">Erros encontrados:</p>
                <div className="max-h-40 overflow-y-auto text-sm">
                  {importResults.filter(r => !r.success).map((result, idx) => (
                    <div key={idx} className="text-destructive">
                      Linha {result.lineNumber}: {result.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
