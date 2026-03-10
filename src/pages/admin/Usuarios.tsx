import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { UserSecurityDialog } from "@/components/admin/UserSecurityDialog";
import { MENU_ITEMS, MenuKey } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, UserPlus, Settings, Trash2, Shield, KeyRound } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableTableHead";

type AppRole = "ADMIN" | "OPERADOR" | "CONSULTA";

interface UserWithProfile {
  id: string;
  email: string;
  nome: string;
  role: AppRole | null;
  is_approved: boolean;
  permissions: string[];
  cpf: string;
  data_nascimento: string;
  pergunta_seguranca: string;
  resposta_seguranca: string;
}

export default function Usuarios() {
  const { isAdmin, user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithProfile | null>(null);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserNome, setNewUserNome] = useState("");
  const [newUserRole, setNewUserRole] = useState<AppRole>("CONSULTA");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const { sortConfig: userSortConfig, handleSort: handleUserSort, sortData: sortUserData } = useTableSort<UserWithProfile>();

  // Redirecionar se não for admin
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Buscar todos os usuários
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      // Buscar profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome, is_approved, is_active");
      if (profilesError) throw profilesError;

      // Buscar roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (rolesError) throw rolesError;

      // Buscar permissões
      const { data: permissions, error: permissionsError } = await supabase
        .from("user_menu_permissions")
        .select("user_id, menu_key");
      if (permissionsError) throw permissionsError;

      // Combinar dados - Nota: não temos acesso ao email via RLS, usamos placeholder
      const usersMap = new Map<string, UserWithProfile>();
      
      profiles?.forEach(profile => {
        usersMap.set(profile.id, {
          id: profile.id,
          email: `Usuário ${profile.nome}`, // Placeholder
          nome: profile.nome,
          role: null,
          is_approved: profile.is_approved ?? false,
          permissions: [],
        });
      });

      roles?.forEach(r => {
        const user = usersMap.get(r.user_id);
        if (user) {
          user.role = r.role as AppRole;
        }
      });

      permissions?.forEach(p => {
        const user = usersMap.get(p.user_id);
        if (user) {
          user.permissions.push(p.menu_key);
        }
      });

      return Array.from(usersMap.values());
    },
  });

  const sortedUsers = useMemo(() => {
    if (!users) return [];
    return sortUserData(users, (item, key) => {
      switch (key) {
        case "nome": return item.nome;
        case "role": return item.role || "";
        case "status": return item.is_approved ? "Aprovado" : "Pendente";
        default: return null;
      }
    });
  }, [users, userSortConfig]);

  // Criar novo usuário
  const createUserMutation = useMutation({
    mutationFn: async ({ email, password, nome, role }: { email: string; password: string; nome: string; role: AppRole }) => {
      // Nota: Criar usuário via admin requer edge function ou Supabase Admin API
      // Por limitações, vamos orientar que o admin convide o usuário
      
      // Por enquanto, apenas mostramos instrução
      throw new Error("Para criar um novo usuário, peça para ele se cadastrar na tela de login. Depois, você pode aprovar e definir as permissões aqui.");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Atualizar role do usuário
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      // Verificar se já existe role
      const { data: existing } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("user_roles")
          .update({ role })
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Papel atualizado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar papel: " + error.message);
    },
  });

  // Aprovar usuário
  const approveUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_approved: true })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Usuário aprovado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao aprovar usuário: " + error.message);
    },
  });

  // Atualizar permissões
  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: string; permissions: string[] }) => {
      // Remover todas as permissões existentes
      const { error: deleteError } = await supabase
        .from("user_menu_permissions")
        .delete()
        .eq("user_id", userId);
      if (deleteError) throw deleteError;

      // Inserir novas permissões
      if (permissions.length > 0) {
        const { error: insertError } = await supabase
          .from("user_menu_permissions")
          .insert(permissions.map(menu_key => ({ user_id: userId, menu_key })));
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setPermissionsDialogOpen(false);
      toast.success("Permissões atualizadas com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar permissões: " + error.message);
    },
  });

  const openPermissionsDialog = (user: UserWithProfile) => {
    setSelectedUser(user);
    setSelectedPermissions([...user.permissions]);
    setPermissionsDialogOpen(true);
  };

  const togglePermission = (menuKey: string) => {
    setSelectedPermissions(prev =>
      prev.includes(menuKey)
        ? prev.filter(k => k !== menuKey)
        : [...prev, menuKey]
    );
  };

  const selectAllPermissions = () => {
    setSelectedPermissions(Object.keys(MENU_ITEMS));
  };

  const clearAllPermissions = () => {
    setSelectedPermissions([]);
  };

  const getRoleBadge = (role: AppRole | null) => {
    switch (role) {
      case "ADMIN":
        return <Badge className="bg-red-100 text-red-700">Admin</Badge>;
      case "OPERADOR":
        return <Badge className="bg-blue-100 text-blue-700">Operador</Badge>;
      case "CONSULTA":
        return <Badge className="bg-gray-100 text-gray-700">Consulta</Badge>;
      default:
        return <Badge variant="outline">Sem papel</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Usuários e Permissões</h1>
          <p className="text-muted-foreground">Gerencie os usuários e suas permissões de acesso</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usuários Cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead sortKey="nome" currentKey={userSortConfig.key} direction={userSortConfig.direction} onSort={handleUserSort}>Nome</SortableTableHead>
                  <SortableTableHead sortKey="role" currentKey={userSortConfig.key} direction={userSortConfig.direction} onSort={handleUserSort}>Papel</SortableTableHead>
                  <SortableTableHead sortKey="status" currentKey={userSortConfig.key} direction={userSortConfig.direction} onSort={handleUserSort}>Status</SortableTableHead>
                  <TableHead>Permissões</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUsers && sortedUsers.length > 0 ? (
                  sortedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.nome}</TableCell>
                      <TableCell>
                        <Select
                          value={user.role || ""}
                          onValueChange={(value) => updateRoleMutation.mutate({ userId: user.id, role: value as AppRole })}
                          disabled={user.id === currentUser?.id}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Selecionar">
                              {getRoleBadge(user.role)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                            <SelectItem value="OPERADOR">Operador</SelectItem>
                            <SelectItem value="CONSULTA">Consulta</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {user.is_approved ? (
                          <Badge className="bg-green-100 text-green-700">Aprovado</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => approveUserMutation.mutate(user.id)}
                          >
                            Aprovar
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {user.role === "ADMIN" 
                            ? "Todas" 
                            : `${user.permissions.length} menu(s)`
                          }
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {user.role !== "ADMIN" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openPermissionsDialog(user)}
                          >
                            <Shield className="h-4 w-4 mr-1" />
                            Permissões
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Adicionar Novo Usuário
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Para adicionar um novo usuário:
            </p>
            <ol className="list-decimal list-inside text-sm text-muted-foreground mt-2 space-y-1">
              <li>Peça para o novo usuário se cadastrar na tela de login</li>
              <li>Após o cadastro, o usuário aparecerá nesta lista</li>
              <li>Clique em "Aprovar" para ativar o acesso</li>
              <li>Defina o papel (Admin/Operador/Consulta)</li>
              <li>Configure as permissões de menu clicando em "Permissões"</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Permissões */}
      <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Permissões de Menu - {selectedUser?.nome}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={selectAllPermissions}>
                Selecionar Todos
              </Button>
              <Button size="sm" variant="outline" onClick={clearAllPermissions}>
                Limpar Todos
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(Object.keys(MENU_ITEMS) as MenuKey[]).map((key) => (
                <div
                  key={key}
                  className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50"
                >
                  <Checkbox
                    id={key}
                    checked={selectedPermissions.includes(key)}
                    onCheckedChange={() => togglePermission(key)}
                  />
                  <Label htmlFor={key} className="cursor-pointer flex-1">
                    {MENU_ITEMS[key].label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedUser) {
                  updatePermissionsMutation.mutate({
                    userId: selectedUser.id,
                    permissions: selectedPermissions,
                  });
                }
              }}
              disabled={updatePermissionsMutation.isPending}
            >
              {updatePermissionsMutation.isPending ? "Salvando..." : "Salvar Permissões"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
