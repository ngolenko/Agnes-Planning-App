CREATE TABLE [ai].[TimeOff] (
    [Id]         NVARCHAR (36)  NOT NULL,
    [EmployeeId] NVARCHAR (36)  NOT NULL,
    [Date]       DATE           NOT NULL,
    [Type]       NVARCHAR (32)  NOT NULL,
    [Status]     NVARCHAR (32)  NOT NULL CONSTRAINT [DF_TimeOff_Status] DEFAULT ('planned'),
    [CreatedAt]  DATETIME2 (7)  NOT NULL CONSTRAINT [DF_TimeOff_CreatedAt] DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt]  DATETIME2 (7)  NOT NULL CONSTRAINT [DF_TimeOff_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_TimeOff] PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [UQ_TimeOff_Employee_Date]
        UNIQUE ([EmployeeId] ASC, [Date] ASC),
    CONSTRAINT [FK_TimeOff_Employee]
        FOREIGN KEY ([EmployeeId]) REFERENCES [ai].[Employee] ([Id]) ON DELETE CASCADE
);
GO
