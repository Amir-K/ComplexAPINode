const shadowPort = 3100;

require("dotenv").config();

process.title = "Complex API Example";

import "reflect-metadata";
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, CreateDateColumn } from "typeorm";
import express from "express";
import cors from "cors";
import path from "path";
import sql from "mssql";
import { initializeLiveDebugger, createShadowMiddleware, liveDebuggerMiddleware } from "./nodeclient/index";

// Entities
@Entity("Users")
class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column()
  email!: string;

  @OneToMany(() => Order, (order: Order) => order.user)
  orders!: Order[];

  @OneToMany(() => Review, (review: Review) => review.user)
  reviews!: Review[];
}

@Entity("Orders")
class Order {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("decimal", { precision: 10, scale: 2 })
  amount!: number;

  @CreateDateColumn()
  created_at!: Date;

  @ManyToOne(() => User, (user: User) => user.orders)
  user!: User;
}

@Entity("Reviews")
class Review {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  content!: string;

  @ManyToOne(() => User, (user: User) => user.reviews)
  user!: User;
}

async function startServer() {
  // const pool = await sql.connect({
  //   user: process.env.DATABASE_USERNAME,
  //   password: process.env.DATABASE_PASSWORD,
  //   server: process.env.DATABASE_HOST!,
  //   database: "amirsdatabase",
  //   // options: {
  //   //   encrypt: false,
  //   //   trustServerCertificate: true,
  //   //   port: 1433,
  //   // },
  //   // options: {
  //   //   encrypt: true,
  //   //   trustServerCertificate: true,
  //   // },
  // });

  initializeLiveDebugger({
    env: {
      PORT: shadowPort,
      DATABASE_HOST: process.env.DATABASE_HOST,
      DATABASE_USERNAME: process.env.DATABASE_USERNAME,
      DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
    } as any,
    // pool,
  });

  console.log('process.env.DATABASE_HOST');

  const app = express();
  app.use(liveDebuggerMiddleware);
  // app.use(createShadowMiddleware(`http://localhost:${shadowPort}`) as any);
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname)));

  async function getData(_query: string, _params: any[]) {
    const query = `
      SELECT TOP 100
        c.FirstName,
        c.LastName,
        c.Email,
        o.OrderID,
        p.ProductName,
        o.Quantity,
        o.OrderDate,
        DATEDIFF(DAY, o.OrderDate, GETDATE()) AS DaysSinceOrder
      FROM dbo.Orders o
      INNER JOIN dbo.Customers c ON o.CustomerID = c.CustomerID
      INNER JOIN dbo.Products p ON o.ProductID = p.ProductID
      WHERE 
        o.OrderDate >= '2024-01-01' AND o.OrderDate < '2025-01-01' -- No YEAR() anymore
        AND p.ProductName LIKE 'Pro%' -- No leading %
        AND c.Country IN ('Australia', 'United States', 'Canada', 'Germany', 'France')
      ORDER BY 
        c.LastName ASC, 
        o.OrderDate DESC
      OPTION (MAXDOP 1);
    `;

    // const result = (await pool.request().query(query)).recordset;

    return [];
  }

  async function getUserStatistics(_userId?: number) {
    return [];
    //return await getData("", []);
  }

  app.get("/api/users/stats", async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      const result = await getUserStatistics(userId);
      res.json(result);
    } catch (error) {
      console.error("Error executing query:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/balances", async (req, res) => {
    try {
      const response = await fetch(
        `https://balanceservice.livelybush-67f33f33.canadacentral.azurecontainerapps.io/api/balancechange`
      );
      const data = (await response.json()) as { result: number[]; timestamp: string; error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Calculation service error");
      }

      const calculations = data.result.map((val, index) => {
        const previousBalance =
          index === 0 ? 0 : data.result.slice(0, index).reduce((acc, curr) => acc + curr, 0);
        const change = val;
        const newBalance = previousBalance + change;

        return {
          previousBalance,
          change,
          newBalance,
        };
      });

      return res.json({
        calculations,
        timestamp: data.timestamp,
      });
    } catch (error) {
      console.error("Error in calculation:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/", (_req, res) => {
    console.log("index.html");
    res.sendFile(path.join(__dirname, "index.html"));
  });

  const PORT = process.env.PORT || 9000;
  app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer();
