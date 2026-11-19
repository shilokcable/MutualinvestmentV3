export type UserRole = 'member' | 'admin';

export interface TransactionItem {
  id?: string;
  date: string;
  type: 'Monthly Deposit' | 'Special Deposit' | 'Withdrawal' | string;
  amount: number;
  note: string;
  memberId?: string;
  name?: string;
}

export interface FdrItem {
  id: string;
  amount: number;
  date: string;
  tenure: number;
  maturity: string;
  bank: string;
  no: string;
  status: 'Active' | 'Maturity Pending' | 'Returned' | string;
  returnDate: string;
  returned: number;
  ref: string;
  note: string;
}

export interface BankEntryItem {
  id: string;
  date: string;
  type: 'Bank Credit' | 'Other Credit' | 'Withdrawal' | 'Other Expense' | string;
  amount: number;
  reference: string;
  note: string;
}

export interface MemberSummary {
  id: string;
  name: string;
  mobile: string;
  status: 'Active' | 'Inactive' | string;
  total: number;
  kycStatus?: string;
  photoData?: string;
}

export interface KycData {
  memberId: string;
  name: string;
  nidNumber: string;
  dob: string;
  fatherName: string;
  motherName: string;
  spouseName: string;
  maritalStatus: string;
  profession: string;
  email: string;
  bdPhone: string;
  whatsapp: string;
  overseasPhone: string;
  tinNumber: string;
  passportNumber: string;
  permanentAddress: string;
  presentAddress: string;
  nomineeName: string;
  nomineeNid: string;
  nomineeDob: string;
  nomineeRelation: string;
  nomineePhone: string;
  nomineeAddress: string;
  notes: string;
  updated: string;
  completed: boolean;
  updatePermission: boolean;
  status: string;
  photoData: string;
  requestStatus?: string;
  requestNote?: string;
  requestText?: string;
  requestDate?: string;
  shareholderNidFront?: string;
  shareholderNidBack?: string;
  memberPhoto?: string;
  tinCertificate?: string;
  passportCopy?: string;
  nomineeNidFront?: string;
  nomineeNidBack?: string;
  nomineePhoto?: string;
}

export interface KycRequestItem {
  id: string;
  memberId: string;
  name: string;
  request: string;
  requestDate: string;
  status: 'Pending' | 'Approved' | 'Rejected' | string;
  approvedDate: string;
  adminNote: string;
}

export interface NoticeItem {
  id: string;
  title: string;
  body: string;
  priority: 'Normal' | 'Important' | 'Urgent' | string;
  createdAt: string;
}

export interface SheetConfig {
  webhookUrl: string;
  sheetUrl: string;
  lastSync: string;
}

export interface MemberDashboardData {
  ok: true;
  role: 'member';
  memberId: string;
  name: string;
  mobile: string;
  accountStatus: string;
  total: number;
  transactions: TransactionItem[];
  mainBank: number;
  fdrBalance: number;
  totalInstitutional: number;
  activeFdr: number;
  pendingFdr: number;
  kyc: KycData;
  notices: NoticeItem[];
}

export interface AdminDashboardData {
  ok: true;
  role: 'admin';
  memberCount: number;
  maxMembers: number;
  totalDeposit: number;
  thisMonth: number;
  mainBank: number;
  fdrBalance: number;
  totalInstitutional: number;
  activeFdr: number;
  pendingFdr: number;
  openingBalance: number;
  members: MemberSummary[];
  recent: TransactionItem[];
  fdrList: FdrItem[];
  bankEntries: BankEntryItem[];
  kycRequests: KycRequestItem[];
  notices: NoticeItem[];
  sheetConfig?: SheetConfig;
}

export type DashboardData = MemberDashboardData | AdminDashboardData;

export interface StatementData {
  ok: true;
  memberId: string;
  name: string;
  mobile: string;
  accountStatus: string;
  total: number;
  transactions: TransactionItem[];
  mainBank: number;
  fdrBalance: number;
  totalInstitutional: number;
}
