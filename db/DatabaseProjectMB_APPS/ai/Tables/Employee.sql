CREATE TABLE [ai].[Employee] (
    [Id]                 NVARCHAR (36)  NOT NULL,
    [Name]               NVARCHAR (255) NOT NULL,
    [Email]              NVARCHAR (255) NOT NULL,
    [Role]               NVARCHAR (100) NOT NULL CONSTRAINT [DF_Employee_Role] DEFAULT (''),
    [Country]            NVARCHAR (2)   NOT NULL CONSTRAINT [DF_Employee_Country] DEFAULT ('DE'),
    [WeeklyCapacityDays] FLOAT (53)     NOT NULL CONSTRAINT [DF_Employee_WeeklyCapacityDays] DEFAULT ((5)),
    [IsActive]           BIT            NOT NULL CONSTRAINT [DF_Employee_IsActive] DEFAULT ((1)),
    [CreatedAt]          DATETIME2 (7)  NOT NULL CONSTRAINT [DF_Employee_CreatedAt] DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt]          DATETIME2 (7)  NOT NULL CONSTRAINT [DF_Employee_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_Employee] PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [UQ_Employee_Email] UNIQUE ([Email])
);
GO
