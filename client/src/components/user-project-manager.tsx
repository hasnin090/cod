import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserIcon, FolderIcon, LinkIcon, UnlinkIcon, PlusIcon } from 'lucide-react';

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  active: boolean;
}

interface Project {
  id: number;
  name: string;
  description: string;
  status: string;
}

interface UserProject {
  userId: number;
  projectId: number;
}

export function UserProjectManager() {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
    retry: false
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    retry: false
  });

  // Get user projects for the selected user
  const { data: userProjects = [], isLoading: userProjectsLoading } = useQuery<Project[]>({
    queryKey: ['/api/users', selectedUser, 'projects'],
    enabled: !!selectedUser,
    retry: false
  });

  const assignMutation = useMutation({
    mutationFn: async (data: { userId: number; projectId: number }) => {
      // نستخدم هذا المسار للتأكد من وصول الطلب لserver/index.ts
      const response = await fetch(`/api/users/${data.userId}/assign-project`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId: data.projectId }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'حدث خطأ غير متوقع' }));
        throw new Error(errorData.message || 'فشل في ربط المستخدم بالمشروع');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "تم بنجاح",
        description: "تم ربط المستخدم بالمشروع بنجاح",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users', selectedUser, 'projects'] });
      setSelectedProject(null);
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل في ربط المستخدم بالمشروع",
        variant: "destructive",
      });
      console.error('Failed to assign user to project:', error);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (data: { userId: number; projectId: number }) => {
      const response = await fetch(`/api/users/${data.userId}/remove-project/${data.projectId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'حدث خطأ غير متوقع' }));
        throw new Error(errorData.message || 'فشل في إزالة ربط المستخدم من المشروع');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "تم بنجاح",
        description: "تم إزالة ربط المستخدم من المشروع بنجاح",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users', selectedUser, 'projects'] });
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل في إزالة ربط المستخدم من المشروع",
        variant: "destructive",
      });
      console.error('Failed to remove user from project:', error);
    },
  });

  const handleAssignProject = () => {
    if (!selectedUser || !selectedProject) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار المستخدم والمشروع أولاً",
        variant: "destructive",
      });
      return;
    }

    assignMutation.mutate({
      userId: selectedUser,
      projectId: selectedProject,
    });
  };

  const handleRemoveProject = (projectId: number) => {
    if (!selectedUser) return;

    removeMutation.mutate({
      userId: selectedUser,
      projectId: projectId,
    });
  };

  const selectedUserData = users.find(u => u.id === selectedUser);
  const availableProjects = projects.filter(p => 
    !userProjects.some(up => up.id === p.id)
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            إدارة ربط المستخدمين بالمشاريع
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">اختر المستخدم:</label>
            <Select 
              value={selectedUser?.toString() || ""} 
              onValueChange={(value) => setSelectedUser(value ? parseInt(value) : null)}
              disabled={usersLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر المستخدم" />
              </SelectTrigger>
              <SelectContent>
                {users.filter(u => u.role !== 'admin').map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4" />
                      <span>{user.name} ({user.username})</span>
                      <Badge variant={user.role === 'user' ? 'default' : 'secondary'}>
                        {user.role === 'user' ? 'مستخدم' : 'مشاهد'}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Project Assignment */}
          {selectedUser && (
            <div className="space-y-2">
              <label className="text-sm font-medium">إضافة مشروع جديد:</label>
              <div className="flex gap-2">
                <Select 
                  value={selectedProject?.toString() || ""} 
                  onValueChange={(value) => setSelectedProject(value ? parseInt(value) : null)}
                  disabled={projectsLoading}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="اختر المشروع" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        <div className="flex items-center gap-2">
                          <FolderIcon className="h-4 w-4" />
                          {project.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleAssignProject}
                  disabled={!selectedProject || assignMutation.isPending}
                  size="sm"
                >
                  {assignMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PlusIcon className="h-4 w-4" />
                  )}
                  ربط
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current User Projects */}
      {selectedUser && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderIcon className="h-5 w-5" />
              مشاريع المستخدم: {selectedUserData?.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userProjectsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">جاري تحميل المشاريع...</span>
              </div>
            ) : userProjects.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                لا توجد مشاريع مربوطة بهذا المستخدم
              </div>
            ) : (
              <div className="space-y-2">
                {userProjects.map((project) => (
                  <div key={project.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <FolderIcon className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">{project.name}</span>
                      <Badge variant="outline">{project.status}</Badge>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveProject(project.id)}
                      disabled={removeMutation.isPending}
                    >
                      {removeMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UnlinkIcon className="h-4 w-4" />
                      )}
                      إزالة الربط
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}