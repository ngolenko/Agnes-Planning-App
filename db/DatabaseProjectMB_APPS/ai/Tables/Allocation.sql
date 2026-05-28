CREATE TABLE [ai].[Allocation] (
    [Id]            NVARCHAR (36) NOT NULL,
    [EmployeeId]    NVARCHAR (36) NOT NULL,
    [ProjectId]     INT           NOT NULL,
    [WeekStartDate] DATE          NOT NULL,
    [PlannedDays]   FLOAT (53)    NOT NULL,
    [CreatedAt]     DATETIME2 (7) NOT NULL CONSTRAINT [DF_Allocation_CreatedAt] DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt]     DATETIME2 (7) NOT NULL CONSTRAINT [DF_Allocation_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_Allocation] PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [UQ_Allocation_Employee_Project_Week]
        UNIQUE ([EmployeeId] ASC, [ProjectId] ASC, [WeekStartDate] ASC),
    CONSTRAINT [FK_Allocation_Employee]
        FOREIGN KEY ([EmployeeId]) REFERENCES [ai].[Employee] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_Allocation_Project]
        FOREIGN KEY ([ProjectId]) REFERENCES [budget].[Project] ([Id])
);
GO
