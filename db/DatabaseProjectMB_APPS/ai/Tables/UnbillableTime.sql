CREATE TABLE [ai].[UnbillableTime] (
    [Id]            NVARCHAR (36) NOT NULL,
    [EmployeeId]    NVARCHAR (36) NOT NULL,
    [WeekStartDate] DATE          NOT NULL,
    [Category]      NVARCHAR (32) NOT NULL,
    [PlannedDays]   FLOAT (53)    NOT NULL,
    [CreatedAt]     DATETIME2 (7) NOT NULL CONSTRAINT [DF_UnbillableTime_CreatedAt] DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt]     DATETIME2 (7) NOT NULL CONSTRAINT [DF_UnbillableTime_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_UnbillableTime] PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [UQ_UnbillableTime_Employee_Week_Category]
        UNIQUE ([EmployeeId] ASC, [WeekStartDate] ASC, [Category] ASC),
    CONSTRAINT [FK_UnbillableTime_Employee]
        FOREIGN KEY ([EmployeeId]) REFERENCES [ai].[Employee] ([Id]) ON DELETE CASCADE
);
GO
