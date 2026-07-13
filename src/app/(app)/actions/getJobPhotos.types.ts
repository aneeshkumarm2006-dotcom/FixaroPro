export type JobPhotoDTO = {
  id: string;
  jobId: string;
  employeeId: string | null;
  employeeName: string;
  kind: "INTAKE" | "AFTER";
  url: string;
  caption: string | null;
  createdAt: Date;
  canDelete: boolean;
};
