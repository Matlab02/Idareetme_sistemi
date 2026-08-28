import { AuditAction, Prisma } from "@prisma/client";
type AuditInput={userId?:string;action:AuditAction;module:string;entityType:string;entityId:string;oldData?:Prisma.InputJsonValue;newData?:Prisma.InputJsonValue;ip?:string;userAgent?:string};
export const audit = { create: (data: AuditInput, client: Prisma.TransactionClient) => client.auditLog.create({data}) };
